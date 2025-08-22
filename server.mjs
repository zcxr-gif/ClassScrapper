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

async function fetchCourses(termCode, subject, courseNumber, client) {
  const formData = new URLSearchParams();
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
  const courses = [];
  const limitHit = $('body').text().includes('All results could not be displayed');

  $("th.ddtitle").each((_, element) => {
    try {
      const titleLink = $(element).find('a');
      const fullTitle = titleLink.text().trim();
      const titleParts = fullTitle.split(" - ");
      if (titleParts.length < 4) return;

      const courseName = titleParts[0].trim();
      const crn = titleParts[1].trim();
      const subjectCode = titleParts[2].trim();
      const section = titleParts[3].trim();
      if (!crn || !/^\d{5}$/.test(crn)) return;

      const schedule = [];
      let primaryInstructor = "N/A";
      
      const detailsRow = $(element).closest('tr').next();
      const meetingTimesTable = detailsRow.find('table.datadisplaytable[summary*="scheduled meeting times"]');
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
      if (schedule.length > 0 && schedule[0].instructor) primaryInstructor = schedule[0].instructor;

      courses.push({
        crn,
        courseName,
        subjectCode,
        section,
        courseNumber: section,
        instructor: primaryInstructor,
        schedule 
      });

    } catch (e) {
      console.error(`Error parsing a course row for subject ${subject}:`, e.message);
    }
  });

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
  details.title = titleElement.contents().first().text().trim();
  if (!details.title) return null;

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

  details.schedule = [];
  details.instructor = "N/A";

  return details;
}

// --- Fetch Catalog Entry (improved, tailored to Farmingdale's markup) ---
async function fetchCatalogEntry(termCode, subject, courseNumber) {
  const cacheKey = `catalog_${termCode}_${subject}_${courseNumber}`;
  try {
    // try cache first
    const cached = await getFromCache(db, cacheKey);
    if (cached) return cached;

    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));
    // Prime session (same pattern used across this file)
    await client.get("https://oasis.farmingdale.edu/pls/prod/bwckschd.p_disp_dyn_sched");

    const url = `https://oasis.farmingdale.edu/pls/prod/bwckctlg.p_display_courses?term_in=${encodeURIComponent(termCode)}&one_subj=${encodeURIComponent(subject)}&sel_crse_strt=${encodeURIComponent(courseNumber)}&sel_crse_end=${encodeURIComponent(courseNumber)}&sel_subj=&sel_levl=&sel_schd=&sel_coll=&sel_divs=&sel_dept=&sel_attr=`;
    const res = await client.get(url);
    const $ = load(res.data);

    const entries = [];

    // Each catalog entry on the page: td.nttitle (title link) followed by td.ntdefault (content)
    $('td.nttitle a').each((i, el) => {
      try {
        const title = $(el).text().trim(); // e.g. "CHM 124L - Principles of Chemistry (Lab)"
        const detailsTd = $(el).closest('tr').next().find('td.ntdefault');

        // Raw HTML and cleaned text for different parsing strategies
        const rawHtml = detailsTd.html() || '';
        const rawText = detailsTd.text().replace(/\r/g, '').split('\n').map(s => s.trim()).filter(Boolean).join('\n');

        // Extract description: everything up to the first label like "Prerequisite(s):" or "Corequisite(s):" or "0.000 Credit"
        let description = rawText;
        const descCutters = [/Prerequisite[s]?:/i, /Corequisite[s]?:/i, /Schedule Types:/i, /Course Attributes:/i, /\d+\.\d+\s+Credit/i, /\d+\.\d+\s+Lab/i];
        for (const rx of descCutters) {
          const m = rawText.search(rx);
          if (m !== -1) {
            description = rawText.slice(0, m).trim();
            break;
          }
        }

        // Prereqs / Coreqs
        const prereqMatch = rawText.match(/Prerequisite[s]?:\s*(.+?)(?:\n|$)/i);
        const coreqMatch = rawText.match(/Corequisite[s]?:\s*(.+?)(?:\n|$)/i);

        // Credits & lab hours (may appear as lines like "0.000 Credit hours" or "3.000   Lab hours")
        const credits = {};
        const creditMatches = [...rawText.matchAll(/(\d+\.\d+)\s+(Credit|Lab)[^\n]*/ig)];
        for (const cm of creditMatches) {
          const val = cm[1];
          const kind = cm[2].toLowerCase();
          if (kind.startsWith('credit')) credits.creditHours = parseFloat(val);
          else if (kind.startsWith('lab')) credits.labHours = parseFloat(val);
          else {
            // fallback to storing by raw kind
            credits[kind] = parseFloat(val);
          }
        }

        // Schedule Types (the page places them after a <SPAN class="fieldlabeltext">Schedule Types:</SPAN>)
        let scheduleTypes = null;
        // Try to parse them from the HTML (keeps links / text intact)
        const schedSpan = detailsTd.find('span.fieldlabeltext').filter((i, s) => $(s).text().trim().startsWith('Schedule Types'));
        if (schedSpan.length) {
          // schedule types appear immediately after the span, sometimes as links + text separated by commas
          const after = schedSpan.closest('td').html().split($(schedSpan).parent().html())[1] || '';
          // fallback: text extraction with the "Schedule Types:" prefix
          const schedText = rawText.match(/Schedule Types:\s*(.+?)(?:\n|$)/i);
          if (schedText) scheduleTypes = schedText[1].split(',').map(s => s.trim()).filter(Boolean);
        } else {
          const schedText = rawText.match(/Schedule Types:\s*(.+?)(?:\n|$)/i);
          if (schedText) scheduleTypes = schedText[1].split(',').map(s => s.trim()).filter(Boolean);
        }

        // Course Attributes
        const attrsMatch = rawText.match(/Course Attributes?:\s*(.+?)(?:\n|$)/i);
        const attributes = attrsMatch ? attrsMatch[1].split(',').map(s => s.trim()).filter(Boolean) : null;

        // Department: lines like "Chemistry Department"
        const deptMatch = rawText.match(/^(.+Department)\s*$/im);
        const department = deptMatch ? deptMatch[1].trim() : null;

        entries.push({
          title,
          description,
          prerequisites: prereqMatch ? prereqMatch[1].trim() : null,
          corequisites: coreqMatch ? coreqMatch[1].trim() : null,
          credits: Object.keys(credits).length ? credits : null,
          scheduleTypes,
          attributes,
          department,
          rawText,
          rawHtml
        });
      } catch (e) {
        console.error('Error parsing a catalog entry block:', e.message);
      }
    });

    // If nothing was parsed, fallback to returning whole page text
    if (entries.length === 0) {
      const whole = $('body').text().trim();
      entries.push({
        title: `${subject} ${courseNumber} (catalog fallback)`,
        description: whole.slice(0, 4000),
        prerequisites: null,
        corequisites: null,
        credits: null,
        scheduleTypes: null,
        attributes: null,
        department: null,
        rawText: whole,
        rawHtml: $('body').html() || ''
      });
    }

    // cache and return
    await saveToCache(db, cacheKey, entries);
    return entries;
  } catch (err) {
    console.error('Failed to fetch catalog entry:', err.message);
    throw err;
  }
}

// --- Catalog endpoint ---
app.get('/catalog/:term/:subject/:course', async (req, res) => {
  try {
    const { term, subject, course } = req.params;
    if (!term || !/^\d{6}$/.test(term) || !subject || !course) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }
    const subjectCode = subject.toUpperCase();
    const catalog = await fetchCatalogEntry(term, subjectCode, course);
    res.json({ count: catalog.length, entries: catalog, source: 'live' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch catalog entry' });
  }
});


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
    const details = await fetchCourseDetails(term, crn);
    if (!details) return res.status(404).json({ error: "Course details unavailable." });
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
