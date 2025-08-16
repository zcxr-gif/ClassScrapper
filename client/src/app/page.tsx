// client/src/app/page.tsx
'use client'; // This is required for components that use state and effects

import { useState, useEffect } from 'react';

// Define TypeScript types for our data
interface Term {
  termName: string;
  termCode: string;
}

interface Course {
  crn: string;
  courseName: string;
  subjectCode: string;
  section: string;
  instructor: string;
}

export default function HomePage() {
  // State variables to hold our data and user selections
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [subject, setSubject] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Get the API URL from the environment variables
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // Fetch the list of available terms when the page loads
  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const res = await fetch(`${API_URL}/terms`);
        if (!res.ok) throw new Error('Failed to fetch terms');
        const data = await res.json();
        setTerms(data);
        if (data.length > 0) {
          setSelectedTerm(data[0].termCode); // Default to the first term
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      }
    };
    fetchTerms();
  }, [API_URL]);

  // Function to handle the search form submission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTerm || !subject) {
      setError('Please select a term and enter a subject code.');
      return;
    }

    setIsLoading(true);
    setError('');
    setCourses([]); // Clear previous results

    try {
      const res = await fetch(`${API_URL}/courses/${selectedTerm}/${subject.toUpperCase()}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'No courses found.');
      }
      const data = await res.json();
      setCourses(data.courses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container mx-auto p-8 font-sans bg-gray-50 min-h-screen">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-800">Course Finder</h1>
        <p className="text-gray-600 mt-2">Farmingdale State College</p>
      </div>

      <form onSubmit={handleSearch} className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="term" className="block text-sm font-medium text-gray-700 mb-1">
              Term
            </label>
            <select
              id="term"
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              {terms.map((term) => (
                <option key={term.termCode} value={term.termCode}>
                  {term.termName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
              Subject Code (e.g., BCS)
            </label>
            <input
              type="text"
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="BCS"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-6 bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <p className="text-center text-red-500 mt-4">{error}</p>}

      <div className="mt-10">
        {isLoading && <p className="text-center">Loading courses...</p>}
        {courses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <div key={course.crn} className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-bold text-lg text-gray-800">{course.courseName}</h3>
                <p className="text-sm text-gray-600">{course.subjectCode} - {course.section}</p>
                <p className="text-sm text-gray-600">CRN: {course.crn}</p>
                <p className="text-sm text-gray-800 mt-2">Instructor: {course.instructor}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}