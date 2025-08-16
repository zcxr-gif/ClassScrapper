document.addEventListener('DOMContentLoaded', () => {
    const termSelect = document.getElementById('term-select');
    const subjectSelect = document.getElementById('subject-select');
    const coursesTbody = document.getElementById('courses-tbody');
    const loadingMessage = document.getElementById('loading-message');
    const modal = document.getElementById('details-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeButton = document.querySelector('.close-button');

    let termsData = [];

    // Fetch terms on page load
    fetch('/terms')
        .then(response => response.json())
        .then(data => {
            termsData = data;
            populateTerms(data);
            termSelect.disabled = false;
        })
        .catch(error => {
            console.error('Error fetching terms:', error);
            termSelect.innerHTML = '<option>Error loading terms</option>';
        });

    termSelect.addEventListener('change', () => {
        const selectedTermCode = termSelect.value;
        if (selectedTermCode) {
            const selectedTerm = termsData.find(term => term.termCode === selectedTermCode);
            populateSubjects(selectedTerm.subjects);
            subjectSelect.disabled = false;
        } else {
            subjectSelect.innerHTML = '<option>Select a term first</option>';
            subjectSelect.disabled = true;
        }
        coursesTbody.innerHTML = '';
    });

    subjectSelect.addEventListener('change', () => {
        const selectedTerm = termSelect.value;
        const selectedSubject = subjectSelect.value;
        if (selectedTerm && selectedSubject) {
            fetchCourses(selectedTerm, selectedSubject);
        }
    });

    function populateTerms(terms) {
        termSelect.innerHTML = '<option value="">Select a Term</option>';
        terms.forEach(term => {
            const option = document.createElement('option');
            option.value = term.termCode;
            option.textContent = term.termName;
            termSelect.appendChild(option);
        });
    }

    function populateSubjects(subjects) {
        subjectSelect.innerHTML = '<option value="">Select a Subject</option>';
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            option.textContent = subject;
            subjectSelect.appendChild(option);
        });
    }

    function fetchCourses(term, subject) {
        loadingMessage.classList.remove('hidden');
        coursesTbody.innerHTML = '';
        fetch(`/courses/${term}/${subject}`)
            .then(response => response.json())
            .then(data => {
                loadingMessage.classList.add('hidden');
                displayCourses(data.courses);
            })
            .catch(error => {
                loadingMessage.classList.add('hidden');
                console.error('Error fetching courses:', error);
                coursesTbody.innerHTML = '<tr><td colspan="6">Error loading courses.</td></tr>';
            });
    }

    function displayCourses(courses) {
        coursesTbody.innerHTML = '';
        if (courses.length === 0) {
            coursesTbody.innerHTML = '<tr><td colspan="6">No courses found.</td></tr>';
            return;
        }
        courses.forEach(course => {
            const row = document.createElement('tr');

            const schedule = course.schedule.map(s => `${s.days} ${s.time}`).join('<br>');

            row.innerHTML = `
                <td>${course.crn}</td>
                <td>${course.courseName}</td>
                <td>${course.section}</td>
                <td>${course.instructor}</td>
                <td>${schedule}</td>
                <td><button class="details-btn" data-term="${termSelect.value}" data-crn="${course.crn}">View Details</button></td>
            `;
            coursesTbody.appendChild(row);
        });
    }

    coursesTbody.addEventListener('click', (event) => {
        if (event.target.classList.contains('details-btn')) {
            const term = event.target.dataset.term;
            const crn = event.target.dataset.crn;
            fetchCourseDetails(term, crn);
        }
    });

    function fetchCourseDetails(term, crn) {
        fetch(`/course-details/${term}/${crn}`)
            .then(response => response.json())
            .then(details => {
                displayCourseDetails(details);
            })
            .catch(error => {
                console.error('Error fetching course details:', error);
                modalBody.innerHTML = '<p>Error loading details.</p>';
            });
    }

    function displayCourseDetails(details) {
        modalTitle.textContent = details.title;

        let seatsInfo = 'Not available';
        if (details.seats && details.seats.capacity) {
            seatsInfo = `
                <p><strong>Seats:</strong> ${details.seats.remaining} remaining of ${details.seats.capacity}</p>
            `;
        }

        let waitlistInfo = 'Not available';
        if (details.waitlist && details.waitlist.capacity) {
            waitlistInfo = `
                <p><strong>Waitlist:</strong> ${details.waitlist.remaining} remaining of ${details.waitlist.capacity}</p>
            `;
        }

        modalBody.innerHTML = `
            <p><strong>Term:</strong> ${details.associatedTerm}</p>
            <p><strong>Levels:</strong> ${details.levels}</p>
            <p><strong>Credits:</strong> ${details.credits}</p>
            ${seatsInfo}
            ${waitlistInfo}
        `;
        modal.classList.remove('hidden');
    }

    closeButton.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.classList.add('hidden');
        }
    });
});