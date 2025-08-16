document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const termSelect = document.getElementById('term-select');
    const subjectSelect = document.getElementById('subject-select');
    const coursesContainer = document.getElementById('courses-container');
    const loadingMessage = document.getElementById('loading-message');
    const initialMessage = document.getElementById('initial-message');

    let termsData = [];

    // --- Main Functions ---

    // Fetches and populates terms on page load
    async function initializeApp() {
        try {
            const response = await fetch('/terms');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            termsData = data;
            populateTerms(data);
            termSelect.disabled = false;
        } catch (error) {
            console.error('Error fetching terms:', error);
            termSelect.innerHTML = '<option>Error loading terms</option>';
        }
    }

    // Populates the term dropdown with "Current/Upcoming" and "Past" categories
    function populateTerms(terms) {
        termSelect.innerHTML = ''; // Clear existing options

        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Select a Term';
        termSelect.appendChild(option);

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-11

        const termGroups = { current: [], past: [] };

        terms.forEach(term => {
            const [season, yearStr] = term.name.split(' ');
            const year = parseInt(yearStr, 10);

            let isPast = false;
            if (year < currentYear) {
                isPast = true;
            } else if (year === currentYear) {
                if (season.toLowerCase().includes('spring') && currentMonth > 4) isPast = true;
                if (season.toLowerCase().includes('summer') && currentMonth > 7) isPast = true;
            }
            if (isPast) termGroups.past.push(term);
            else termGroups.current.push(term);
        });
        
        // Create optgroups for a better user experience
        termSelect.appendChild(createOptgroup('Current & Upcoming', termGroups.current));
        termSelect.appendChild(createOptgroup('Past Semesters', termGroups.past));
    }

    // Helper to create and populate an <optgroup>
    function createOptgroup(label, terms) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = label;
        terms.forEach(term => {
            const option = document.createElement('option');
            option.value = term.termCode;
            option.textContent = term.name;
            optgroup.appendChild(option);
        });
        return optgroup;
    }

    // Fetches and displays courses for the selected term and subject
    async function fetchAndDisplayCourses(term, subject) {
        initialMessage.classList.add('hidden');
        coursesContainer.innerHTML = '';
        loadingMessage.classList.remove('hidden');

        try {
            const response = await fetch(`/courses/${term}/${subject}`);
            if (!response.ok) throw new Error(`No courses found for ${subject}.`);
            const data = await response.json();
            displayCourses(data.courses);
        } catch (error) {
            console.error('Error fetching courses:', error);
            coursesContainer.innerHTML = `<p class="error-message">${error.message}</p>`;
        } finally {
            loadingMessage.classList.add('hidden');
        }
    }

    // Renders course data into the new card format
    function displayCourses(courses) {
        coursesContainer.innerHTML = '';
        if (courses.length === 0) {
            initialMessage.classList.remove('hidden');
            initialMessage.textContent = 'No courses found for this subject.';
            return;
        }

        courses.forEach(course => {
            const { modality, modalityClass } = determineModality(course.schedule);
            
            const scheduleHtml = course.schedule.map(s => 
                `<li>${s.days || 'TBA'} | ${s.time || 'TBA'} | <strong>${s.where || 'TBA'}</strong></li>`
            ).join('');

            const card = document.createElement('div');
            card.className = 'course-card';
            card.dataset.term = termSelect.value;
            card.dataset.crn = course.crn;
            card.innerHTML = `
                <div class="card-main">
                    <div class="card-header">
                        <h3>${course.courseName}</h3>
                        <div class="course-meta">
                            <div class="course-info">
                                <span class="crn">CRN: ${course.crn}</span>
                                <span class="section">Sec: ${course.section}</span>
                            </div>
                            <div class="course-tags">
                                <span class="modality-tag ${modalityClass}">${modality}</span>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        <p><strong>Instructor:</strong> ${course.instructor}</p>
                        <ul class="schedule-list">${scheduleHtml}</ul>
                    </div>
                </div>
                <div class="card-details"></div>
            `;
            coursesContainer.appendChild(card);
        });
    }

    // Determines course modality based on location data
    function determineModality(schedule) {
        if (!schedule || schedule.length === 0) {
            return { modality: 'Online', modalityClass: 'modality-online' };
        }
        const hasPhysicalLocation = schedule.some(s => 
            s.where && (s.where.match(/\d/) || s.where.toLowerCase().includes('hall'))
        );
        return hasPhysicalLocation 
            ? { modality: 'In-Person', modalityClass: 'modality-in-person' }
            : { modality: 'Online', modalityClass: 'modality-online' };
    }

    // Fetches details and injects them into the clicked card
    async function fetchAndDisplayDetails(card) {
        const { term, crn } = card.dataset;
        const detailsContainer = card.querySelector('.card-details');
        
        detailsContainer.innerHTML = '<div class="spinner"></div>';
        
        try {
            const response = await fetch(`/course-details/${term}/${crn}`);
            if (!response.ok) throw new Error('Details not found.');
            const details = await response.json();
            
            const seats = details.seats;
            const waitlist = details.waitlist;
            
            // Determine status and update tag
            let statusClass = 'status-full';
            let statusText = 'Full';
            if (seats.remaining > 0) {
                statusClass = 'status-open';
                statusText = 'Open';
            } else if (waitlist.remaining > 0) {
                statusClass = 'status-waitlist';
                statusText = 'Waitlist';
            }
            updateStatusTag(card, statusClass, statusText);

            detailsContainer.innerHTML = `
                <div class="details-grid">
                    <p><strong>Credits:</strong> ${details.credits || 'N/A'}</p>
                    <p><strong>Levels:</strong> ${details.levels || 'N/A'}</p>
                    <p><strong>Seats:</strong> ${seats.remaining} / ${seats.capacity}</p>
                    <p><strong>Waitlist:</strong> ${waitlist.remaining} / ${waitlist.capacity}</p>
                </div>
            `;
        } catch (error) {
            detailsContainer.innerHTML = `<p class="error-message">${error.message}</p>`;
        }
    }

    function updateStatusTag(card, statusClass, statusText) {
        // Remove old status tag if it exists
        const oldTag = card.querySelector('.status-tag');
        if (oldTag) oldTag.remove();

        const tag = document.createElement('span');
        tag.className = `status-tag ${statusClass}`;
        tag.textContent = statusText;
        card.querySelector('.course-tags').prepend(tag);
    }

    // --- Event Listeners ---
    termSelect.addEventListener('change', () => {
        const selectedTermCode = termSelect.value;
        subjectSelect.innerHTML = '<option value="">Select a Subject</option>';
        coursesContainer.innerHTML = '';
        initialMessage.classList.remove('hidden');
        initialMessage.textContent = 'Please select a term and subject to see available courses.';
        
        if (selectedTermCode) {
            const selectedTerm = termsData.find(term => term.termCode === selectedTermCode);
            selectedTerm.subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject;
                option.textContent = subject;
                subjectSelect.appendChild(option);
            });
            subjectSelect.disabled = false;
        } else {
            subjectSelect.disabled = true;
        }
    });

    subjectSelect.addEventListener('change', () => {
        const term = termSelect.value;
        const subject = subjectSelect.value;
        if (term && subject) {
            fetchAndDisplayCourses(term, subject);
        }
    });

    coursesContainer.addEventListener('click', (event) => {
        const card = event.target.closest('.course-card');
        if (!card) return;

        const wasActive = card.classList.contains('active');
        
        // Close all other active cards
        document.querySelectorAll('.course-card.active').forEach(activeCard => {
            activeCard.classList.remove('active');
        });

        // If the clicked card wasn't the one that was active, open it
        if (!wasActive) {
            card.classList.add('active');
            // Fetch details only if they haven't been loaded yet
            if (card.querySelector('.card-details').innerHTML === '') {
                fetchAndDisplayDetails(card);
            }
        }
    });

    // --- Initialize the App ---
    initializeApp();
});