import express from "express";
import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { load } from "cheerio";
import crypto from "crypto";
import cron from "node-cron";

// Import the database helper functions
import { setupDatabase, getFromCache, saveToCache } from "./database.mjs";

const app = express();
const PORT = 3000;

// --- Serve static files from the 'public' directory ---
app.use(express.static('public'));

// --- Database Setup ---
let db;
setupDatabase().then(database => {
  db = database;
  console.log("✅ Database cache is ready.");
  
  // Ensure watched_courses table exists
  db.run(`
    CREATE TABLE IF NOT EXISTS watched_courses (
      term TEXT NOT NULL,
      crn TEXT NOT NULL,
      last_seats_remaining INTEGER,
      last_waitlist_remaining INTEGER,
      last_schedule_hash TEXT,
      PRIMARY KEY (term, crn)
    )
  `);
  
}).catch(err => {
  console.error("❌ Failed to set up database:", err);
  process.exit(1);
});

// --- Utility Function ---
function hashSchedule(schedule) {
  const str = JSON.stringify(schedule);
  return crypto.createHash('md5').update(str).digest('hex');
}

// --- Helper Functions (Scraping Logic) ---
async function scrapeCatalogPage(url, client) {
  try {
    const res = await client.get(url);
    const $ = load(res.data);

    const results = [];

    // Each course block is inside a table.datadisplaytable (from sample)
    $('table.datadisplaytable').each((_, table) => {
      const $table = $(table);
      const titleLink = $table.find('td.nttitle a').first();
      if (!titleLink.length) return; // skip non-course tables

      const titleText = titleLink.text().trim(); // e.g. "CHM 124L - Principles..."
      const href = titleLink.attr('href') || null;

      // Try to split subject + number from title
      let subject = null, number = null, courseTitle = titleText;
      const m = titleText.match(/^([A-Z]{2,4})\s+([0-9A-Z-]+)\s*-\s*(.*)$/);
      if (m) {
        subject = m[1];
        number = m[2];
        courseTitle = m[3].trim();
      } else {
        // fallback: try split at first ' - '
        const parts = titleText.split(' - ');
        if (parts.length >= 2) {
          courseTitle = parts.slice(1).join(' - ').trim();
        }
      }

      // Find the details cell that follows the title in same table
      const detailsTd = $table.find('td.ntdefault').first();
      if (!detailsTd.length) {
        results.push({
          title: courseTitle,
          subject,
          number,
          href,
          error: 'No details cell found'
        });
        return;
      }

      // Preserve <br> as newlines, and close-block tags as newlines
      let detailsHtml = detailsTd.html() || '';
      detailsHtml = detailsHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|ul|ol|table|tr|td)>/gi, '\n')
        .replace(/&nbsp;/g, ' ');

      // Strip remaining tags, then normalize whitespace and split into lines
      const tmp = load('<div>' + detailsHtml + '</div>');
      let text = tmp('div').text();
      text = text.replace(/\r/g, '').split('\n').map(s => s.trim()).filter(Boolean).join('\n');

      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      // Helper to read a multi-line value: if the value after ":" is empty,
      // take subsequent non-header lines as continuation
      const headers = ['Prerequisite', 'Corequisite', 'Course Attributes', 'Schedule Types', 'Levels', 'Credit hours', 'Lab hours'];

      function readField(startIdx, headerName) {
        // startIdx points to a line that begins with headerName (case-insensitive)
        const line = lines[startIdx];
        const afterColon = line.split(':').slice(1).join(':').trim();
        if (afterColon) return afterColon;

        // multiline: collect next lines until we hit a known header or empty line
        const collected = [];
        for (let i = startIdx + 1; i < lines.length; i++) {
          const ln = lines[i];
          const isHeader = headers.some(h => new RegExp('^' + h + '(:|$)', 'i').test(ln));
          if (isHeader) break;
          collected.push(ln);
        }
        return collected.join(' ').trim() || null;
      }

      // find index of first header to split description
      const headerIdx = lines.findIndex(ln => {
        return /^Prerequisite/i.test(ln)
          || /^Corequisite/i.test(ln)
          || /Credit hours/i.test(ln)
          || /^Levels:/i.test(ln)
          || /^Course Attributes:/i.test(ln)
          || /^Schedule Types:/i.test(ln);
      });

      const description = headerIdx === -1 ? lines.join(' ') : lines.slice(0, headerIdx).join(' ');

      // Now extract fields by scanning lines
      let prerequisites = null;
      let corequisites = null;
      let credits = null;
      let labHours = null;
      let levels = null;
      let scheduleTypes = null;
      let department = null;
      let attributes = null;

      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];

        if (/^Prerequisite/i.test(ln)) {
          prerequisites = readField(i, 'Prerequisite');
          continue;
        }
        if (/^Corequisite/i.test(ln)) {
          corequisites = readField(i, 'Corequisite');
          continue;
        }
        if (/Credit hours/i.test(ln)) {
          const m = ln.match(/(\d+\.\d+)/);
          if (m) credits = m[1];
          continue;
        }
        if (/Lab hours/i.test(ln)) {
          const m = ln.match(/(\d+\.\d+)/);
          if (m) labHours = m[1];
          continue;
        }
        if (/^Levels:/i.test(ln)) {
          levels = ln.split(':').slice(1).join(':').trim();
          continue;
        }
        if (/^Schedule Types:/i.test(ln)) {
          const val = readField(i, 'Schedule Types');
          scheduleTypes = val ? val.split(',').map(s => s.trim()).filter(Boolean) : null;
          continue;
        }
        if (/Department$/i.test(ln)) {
          department = ln.replace(/Department$/i, '').trim();
          continue;
        }
        if (/^Course Attributes:/i.test(ln)) {
          const val = readField(i, 'Course Attributes');
          if (val) {
            // Attributes may be separated by commas or ' - ' or multiple spaces
            attributes = val.split(/,|;|\u2013| - /).map(s => s.trim()).filter(Boolean);
          }
          continue;
        }
      }

      results.push({
        title: courseTitle,
        subject,
        number,
        href,
        description: description || null,
        prerequisites: prerequisites || null,
        corequisites: corequisites || null,
        credits: credits || null,
        labHours: labHours || null,
        levels: levels || null,
        scheduleTypes: scheduleTypes || null,
        department: department || null,
        attributes: attributes || null,
        rawText: text // include raw text for debugging if you need it
      });
    }); // end each table

    // If you expected only one course from the page, return first
    if (results.length === 0) {
      return { error: "No course blocks found on page." };
    } else if (results.length === 1) {
      return results[0];
    } else {
      return results; // array when page lists multiple courses
    }

  } catch (e) {
    console.error(`Error scraping catalog page at ${url}:`, e && e.message);
    return { error: "Failed to scrape catalog page." };
  }
}

async function fetchTerms() {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar }));
  const response = await client.get("https://oasis.farmingdale.edu/pls/prod/bwckschd.p_disp_dyn_sched");
  const $ = load(response.data);
  const terms = [];

  $('select[name="p_term"] option').each((_, element) => {
    const termCode = $(element).attr('value');
    const termName = $(element).text().trim();
    if (termCode && /^\d{6}$/.test(termCode)) {
      terms.push({ code: termCode, name: termName });
    }
  });

  console.log(`Discovered ${terms.length} available terms from source.`);
  return terms;
}

async function fetchSubjects(termCode) {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar }));
  await client.get("https://oasis.farmingdale.edu/pls/prod/bwckschd.p_disp_dyn_sched");

  const formData = new URLSearchParams();
  formData.append("p_calling_proc", "bwckschd.p_disp_dyn_sched");
  formData.append("p_term", termCode);

  const response = await client.post(
    "https://oasis.farmingdale.edu/pls/prod/bwckgens.p_proc_term_date",
    formData.toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  
  const $ = load(response.data);
  const subjects = [];
  $('#subj_id option').each((_, element) => {
    const value = $(element).attr('value');
    if (value && value !== '%') {
      subjects.push(value);
    }
  });

  return subjects;
}

// --- MODIFIED fetchCourses Function ---
async function fetchCourses(termCode, subject, courseNumber, client) {
  const formData = new URLSearchParams();
  // ... (keep all the formData.append lines exactly as they are)
  formData.append("term_in", termCode);
  formData.append("sel_subj", "dummy");
  formData.append("sel_day", "dummy");
  formData.append("sel_schd", "dummy");
  formData.append("sel_insm", "dummy");
  formData.append("sel_camp", "dummy");
  formData.append("sel_levl", "dummy");
  formData.append("sel_sess", "dummy");
  formData.append("sel_instr", "dummy");
  formData.append("sel_ptrm", "dummy");
  formData.append("sel_attr", "dummy");
  formData.append("sel_subj", subject);
  formData.append("sel_crse", courseNumber);
  formData.append("sel_title", "");
  formData.append("sel_insm", "%");
  formData.append("sel_from_cred", "");
  formData.append("sel_to_cred", "");
  formData.append("sel_ptrm", "%");
  formData.append("sel_instr", "%");
  formData.append("sel_attr", "%");
  formData.append("begin_hh", "0");
  formData.append("begin_mi", "0");
  formData.append("begin_ap", "a");
  formData.append("end_hh", "0");
  formData.append("end_mi", "0");
  formData.append("end_ap", "a");

  const res = await client.post(
    "https://oasis.farmingdale.edu/pls/prod/bwckschd.p_get_crse_unsec",
    formData.toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  const $ = load(res.data);
  const coursePromises = [];
  const limitHit = $('body').text().includes('All results could not be displayed');

  $("th.ddtitle").each((_, element) => {
    const promise = (async () => {
      try {
        const titleLink = $(element).find('a');
        const fullTitle = titleLink.text().trim();
        const titleParts = fullTitle.split(" - ");
        if (titleParts.length < 4) return null;

        const courseName = titleParts[0].trim();
        const crn = titleParts[1].trim();
        const subjectCode = titleParts[2].trim();
        const section = titleParts[3].trim();
        if (!crn || !/^\d{5}$/.test(crn)) return null;

        const detailsRow = $(element).closest('tr').next();
        
        // --- NEW: Find catalog link and scrape it ---
        const catalogLinkElement = detailsRow.find('a:contains("View Catalog Entry")');
        let catalogData = {};
        if (catalogLinkElement.length > 0) {
          const catalogUrl = "https://oasis.farmingdale.edu" + catalogLinkElement.attr('href');
          catalogData = await scrapeCatalogPage(catalogUrl, client);
        }
        // --- END NEW ---

        const meetingTimesTable = detailsRow.find('table.datadisplaytable[summary*="scheduled meeting times"]');
        const meetingRows = meetingTimesTable.find('tr');
        const schedule = [];
        let primaryInstructor = "N/A";

        if (meetingRows.length > 1) {
          meetingRows.slice(1).each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 7) {
              const instructorName = cells.eq(6).text().split('(')[0].trim().replace(/\s+/g, ' ');
              schedule.push({
                type: cells.eq(0).text().trim(),
                time: cells.eq(1).text().trim(),
                days: cells.eq(2).text().trim(),
                where: cells.eq(3).text().trim(),
                dateRange: cells.eq(4).text().trim(),
                scheduleType: cells.eq(5).text().trim(),
                instructor: instructorName
              });
            }
          });
        }
        if (schedule.length > 0 && schedule[0].instructor) primaryInstructor = schedule[0].instructor;

        return {
          crn,
          courseName,
          subjectCode,
          section,
          instructor: primaryInstructor,
          schedule,
          catalog: catalogData // Merge catalog data here
        };

      } catch (e) {
        console.error(`Error parsing a course row for subject ${subject}:`, e.message);
        return null; // Return null on error
      }
    })();
    coursePromises.push(promise);
  });

  const courses = (await Promise.all(coursePromises)).filter(Boolean); // Await all and filter out any nulls
  return { courses, limitHit };
}

async function getAllCoursesForSubject(term, subject, client) {
  const initialResult = await fetchCourses(term, subject, '', client);
  if (initialResult.limitHit) {
    console.log(`Limit hit for subject ${subject}. Subdividing search...`);
    const courseLevels = ['1','2','3','4','5','6','7','8','9'];
    const subPromises = courseLevels.map(level => fetchCourses(term, subject, `${level}%`, client));
    const subdividedResults = await Promise.all(subPromises);
    return subdividedResults.flatMap(result => result.courses); 
  } else {
    return initialResult.courses;
  }
}

async function fetchCourseDetails(termCode, crn) {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar }));
  await client.get("https://oasis.farmingdale.edu/pls/prod/bwckschd.p_disp_dyn_sched");
  const url = `https://oasis.farmingdale.edu/pls/prod/bwckschd.p_disp_detail_sched?term_in=${termCode}&crn_in=${crn}`;
  const res = await client.get(url);
  const $ = load(res.data);
  const details = {};

  const titleElement = $("th.ddlabel").first();
  const fullTitle = titleElement.contents().first().text().trim();
  details.title = fullTitle;
  if (!details.title) return null;

  // --- NEW CODE: Parse Subject and Course Number from the title ---
  const titleParts = fullTitle.split(' - ');
  let subject = null;
  let courseNumber = null;

  if (titleParts.length >= 3) {
    const subjectAndCourse = titleParts[2].trim();
    const lastSpaceIndex = subjectAndCourse.lastIndexOf(' ');
    if (lastSpaceIndex !== -1) {
      subject = subjectAndCourse.substring(0, lastSpaceIndex).trim();
      courseNumber = subjectAndCourse.substring(lastSpaceIndex + 1).trim();
    }
  }
  // --- END NEW CODE ---

  const detailsBlock = titleElement.closest('tr').next().find('td.dddefault').text();
  
  const termMatch = detailsBlock.match(/Associated Term: (.*?)\n/);
  if (termMatch) details.associatedTerm = termMatch[1].trim();

  const levelsMatch = detailsBlock.match(/Levels: (.*?)\n/);
  if (levelsMatch) details.levels = levelsMatch[1].trim();

  const creditsMatch = detailsBlock.match(/(\d+\.\d+) Credits/);
  if (creditsMatch) details.credits = creditsMatch[1].trim();

  const availabilityTable = $('caption:contains("Registration Availability")').closest("table.datadisplaytable");
  details.seats = {};
  details.waitlist = {};
  availabilityTable.find('tr').each((_, row) => {
    const label = $(row).find('th').text().trim();
    const cells = $(row).find('td');
    if (label === 'Seats') {
      details.seats.capacity = cells.eq(0).text().trim();
      details.seats.actual = cells.eq(1).text().trim();
      details.seats.remaining = cells.eq(2).text().trim();
    }
    if (label === 'Waitlist Seats') {
      details.waitlist.capacity = cells.eq(0).text().trim();
      details.waitlist.actual = cells.eq(1).text().trim();
      details.waitlist.remaining = cells.eq(2).text().trim();
    }
  });

  // --- START: Added Code to Parse Schedule and Instructor ---
  const schedule = [];
  let primaryInstructor = "N/A";
  
  const meetingTimesTable = $('table.datadisplaytable[summary*="Scheduled Meeting Times"]');
  const meetingRows = meetingTimesTable.find('tr');

  if (meetingRows.length > 1) {
    meetingRows.slice(1).each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 7) {
        const instructorName = cells.eq(6).text().split('(')[0].trim().replace(/\s+/g, ' ');
        schedule.push({
          type: cells.eq(0).text().trim(),
          time: cells.eq(1).text().trim(),
          days: cells.eq(2).text().trim(),
          where: cells.eq(3).text().trim(),
          dateRange: cells.eq(4).text().trim(),
          scheduleType: cells.eq(5).text().trim(),
          instructor: instructorName
        });
      }
    });
  }
  
  if (schedule.length > 0 && schedule[0].instructor) {
    primaryInstructor = schedule[0].instructor;
  }
  
  details.schedule = schedule;
  details.instructor = primaryInstructor;
  // --- END: Added Code ---



details.subject = subject;
  details.courseNumber = courseNumber;

  return details;
}



// --- API Endpoints ---
app.get("/terms", async (req, res) => {
  const cacheKey = "all_terms_with_subjects";
  try {
    const cachedData = await getFromCache(db, cacheKey);
    if (cachedData) return res.json(cachedData);

    const terms = await fetchTerms();
    if (terms.length === 0) return res.status(404).json({ error: "No terms available." });

    const allTermData = await Promise.all(
      terms.map(async (term) => {
        const subjects = await fetchSubjects(term.code);
        return { termName: term.name, termCode: term.code, subjectCount: subjects.length, subjects };
      })
    );

    await saveToCache(db, cacheKey, allTermData);
    res.json(allTermData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch terms." });
  }
});

app.get("/courses/:term/:subject", async (req, res) => {
  try {
    const { term, subject } = req.params;
    if (!term || !/^\d{6}$/.test(term) || !subject || !/^[A-Z]{3,4}$/.test(subject.toUpperCase())) {
      return res.status(400).json({ error: "Invalid term or subject code." });
    }

    const subjectCode = subject.toUpperCase();
    const cacheKey = `courses_${term}_${subjectCode}`;
    const cachedData = await getFromCache(db, cacheKey);
    if (cachedData) return res.json({ count: cachedData.length, courses: cachedData, source: "cache" });

    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));
    await client.get("https://oasis.farmingdale.edu/pls/prod/bwckschd.p_disp_dyn_sched");
    const courses = await getAllCoursesForSubject(term, subjectCode, client);
    await saveToCache(db, cacheKey, courses);
    res.json({ count: courses.length, courses, source: "live" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch courses." });
  }
});

app.get("/courses/:term", async (req, res) => {
  try {
    const term = req.params.term;
    if (!term || !/^\d{6}$/.test(term)) return res.status(400).json({ error: "Invalid term code." });

    const cacheKey = `allcourses_${term}`;
    const cachedData = await getFromCache(db, cacheKey);
    if (cachedData) return res.json({ count: cachedData.length, courses: cachedData, source: "cache" });

    const subjects = await fetchSubjects(term);
    if (subjects.length === 0) return res.status(404).json({ error: "No subjects found for this term." });

    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));
    await client.get("https://oasis.farmingdale.edu/pls/prod/bwckschd.p_disp_dyn_sched");

    const coursePromises = subjects.map(subject => getAllCoursesForSubject(term, subject, client));
    const nestedCourses = await Promise.all(coursePromises);
    const allCourses = nestedCourses.flat();

    await saveToCache(db, cacheKey, allCourses);
    res.json({ count: allCourses.length, courses: allCourses, source: "live" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch all courses." });
  }
});

app.get("/course-details/:term/:crn", async (req, res) => {
  try {
    const { term, crn } = req.params;
    if (!term || !/^\d{6}$/.test(term) || !crn || !/^\d{5}$/.test(crn)) {
      return res.status(400).json({ error: "Invalid term or CRN." });
    }

    // 1. Fetch live details (especially seat counts) from the detail page
    const details = await fetchCourseDetails(term, crn);
    if (!details) {
      return res.status(404).json({ error: "Course details unavailable." });
    }

    // 2. Now, try to find the instructor from our cached data, since the
    //    detail page doesn't provide it.
    if (details.subject) {
      const cacheKey = `courses_${term}_${details.subject.toUpperCase()}`;
      const cachedCourses = await getFromCache(db, cacheKey);

      if (cachedCourses) {
        const cachedCourseInfo = cachedCourses.find(c => c.crn === crn);
        
        if (cachedCourseInfo) {
          // 3. Merge the cached instructor/schedule into our live details
          details.instructor = cachedCourseInfo.instructor;
          details.schedule = cachedCourseInfo.schedule;
          details.courseName = cachedCourseInfo.courseName; // Also grab the better-parsed name
        }
      }
    }

    res.json(details);
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch course details." });
  }
});

// --- Watchlist Endpoints ---
app.post("/watch/:term/:crn", async (req, res) => {
  try {
    const { term, crn } = req.params;
    const details = await fetchCourseDetails(term, crn);
    if (!details) return res.status(404).json({ error: "Course not found" });

    const lastScheduleHash = hashSchedule(details.schedule);
    await db.run(
      `INSERT OR REPLACE INTO watched_courses
       (term, crn, last_seats_remaining, last_waitlist_remaining, last_schedule_hash)
       VALUES (?, ?, ?, ?, ?)`,
       term, crn, parseInt(details.seats.remaining), parseInt(details.waitlist.remaining), lastScheduleHash
    );

    res.json({ message: `Course ${crn} in term ${term} added to watchlist` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add course to watchlist" });
  }
});

app.delete("/watch/:term/:crn", async (req, res) => {
  try {
    const { term, crn } = req.params;
    await db.run(`DELETE FROM watched_courses WHERE term = ? AND crn = ?`, term, crn);
    res.json({ message: `Course ${crn} in term ${term} removed from watchlist` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove course from watchlist" });
  }
});

// --- Cron Job: Poll watched courses every 5 minutes ---
async function pollWatchedCourses() {
  try {
    const rows = await db.all("SELECT * FROM watched_courses");
    
    for (const row of rows) {
      try {
        const details = await fetchCourseDetails(row.term, row.crn);
        if (!details) continue;

        const newSeatsRemaining = parseInt(details.seats.remaining);
        const newWaitlistRemaining = parseInt(details.waitlist.remaining);
        const newScheduleHash = hashSchedule(details.schedule);

        let updated = false;

        if (row.last_seats_remaining !== newSeatsRemaining ||
            row.last_waitlist_remaining !== newWaitlistRemaining ||
            row.last_schedule_hash !== newScheduleHash) {
          updated = true;
          console.log(`🔄 Update detected for CRN ${row.crn} (Term ${row.term})`);

          await db.run(
            `UPDATE watched_courses 
             SET last_seats_remaining = ?, last_waitlist_remaining = ?, last_schedule_hash = ?
             WHERE term = ? AND crn = ?`,
             newSeatsRemaining, newWaitlistRemaining, newScheduleHash, row.term, row.crn
          );
        }

        if (!updated) console.log(`✅ No change for CRN ${row.crn}`);
      } catch (err) {
        console.error(`Error fetching course ${row.crn}:`, err.message);
      }
    }
  } catch (err) {
    console.error("Error polling watched courses:", err.message);
  }
}

cron.schedule('*/5 * * * *', () => {
  console.log('🕒 Polling watched courses...');
  pollWatchedCourses();
});

// --- Cron Job: Refresh all course data hourly ---
async function refreshAllCourses() {
  try {
    console.log('🕒 Starting hourly full course data refresh...');
    
    const terms = await fetchTerms();
    for (const term of terms) {
      const subjects = await fetchSubjects(term.code);
      for (const subject of subjects) {
        try {
          const jar = new CookieJar();
          const client = wrapper(axios.create({ jar }));
          await client.get("https://oasis.farmingdale.edu/pls/prod/bwckschd.p_disp_dyn_sched");
          
          const courses = await getAllCoursesForSubject(term.code, subject, client);
          const cacheKey = `courses_${term.code}_${subject}`;
          await saveToCache(db, cacheKey, courses);
          console.log(`✅ Cached ${courses.length} courses for ${subject} (${term.code})`);
        } catch (err) {
          console.error(`❌ Failed to fetch courses for ${subject} (${term.code}):`, err.message);
        }
      }

      // Optionally cache all courses for the term
      try {
        const cacheKeyAll = `allcourses_${term.code}`;
        const allCourses = [];
        for (const subject of subjects) {
          const cacheKey = `courses_${term.code}_${subject}`;
          const cached = await getFromCache(db, cacheKey);
          if (cached) allCourses.push(...cached);
        }
        await saveToCache(db, cacheKeyAll, allCourses);
        console.log(`✅ Cached all courses for term ${term.code}`);
      } catch (err) {
        console.error(`❌ Failed to cache all courses for term ${term.code}:`, err.message);
      }
    }

    console.log('🕒 Hourly course refresh completed.');
  } catch (err) {
    console.error('❌ Error during hourly course refresh:', err.message);
  }
}

// Schedule the hourly refresh (minute 0 of every hour)
cron.schedule('0 * * * *', () => {
  refreshAllCourses();
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
