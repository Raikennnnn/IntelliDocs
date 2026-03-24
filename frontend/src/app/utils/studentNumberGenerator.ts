/**
 * Student Number Generation System
 * 
 * This utility manages the auto-generation of school-based student numbers.
 * Student Number Format: YYYY-#### (e.g., 2026-0001)
 * 
 * Key Features:
 * - Year-based sequential numbering
 * - NOT dependent on LRN
 * - LRN is kept separate for DepEd reference only
 * - Student Number is the system's primary identifier
 */

export interface StudentNumberConfig {
  year: number;
  lastSequence: number;
}

/**
 * Generate the next student number based on the current year and last sequence
 */
export function generateStudentNumber(year?: number, lastSequence?: number): string {
  const currentYear = year || new Date().getFullYear();
  const nextSequence = (lastSequence || 0) + 1;
  
  // Format: YYYY-#### (e.g., 2026-0001)
  const formattedSequence = nextSequence.toString().padStart(4, '0');
  
  return `${currentYear}-${formattedSequence}`;
}

/**
 * Parse a student number to extract year and sequence
 */
export function parseStudentNumber(studentNumber: string): { year: number; sequence: number } | null {
  const regex = /^(\d{4})-(\d{4})$/;
  const match = studentNumber.match(regex);
  
  if (!match) {
    return null;
  }
  
  return {
    year: parseInt(match[1], 10),
    sequence: parseInt(match[2], 10)
  };
}

/**
 * Validate student number format
 */
export function isValidStudentNumber(studentNumber: string): boolean {
  const regex = /^(\d{4})-(\d{4})$/;
  return regex.test(studentNumber);
}

/**
 * Get the next student number for the active school year
 * In a real system, this would query the database for the last sequence number
 */
export function getNextStudentNumber(schoolYear: string, existingStudents: any[] = []): string {
  // Extract year from school year format (e.g., "2025-2026" -> 2025)
  const startYear = parseInt(schoolYear.split('-')[0], 10);
  
  // Find the highest sequence number for this year
  let maxSequence = 0;
  
  existingStudents.forEach(student => {
    if (student.studentNumber) {
      const parsed = parseStudentNumber(student.studentNumber);
      if (parsed && parsed.year === startYear && parsed.sequence > maxSequence) {
        maxSequence = parsed.sequence;
      }
    }
  });
  
  return generateStudentNumber(startYear, maxSequence);
}

/**
 * Validate LRN (Learner Reference Number) format
 * LRN is 12 digits for DepEd reference
 */
export function isValidLRN(lrn: string): boolean {
  const regex = /^\d{12}$/;
  return regex.test(lrn);
}

/**
 * Format LRN for display (add dashes for readability)
 * Example: 123456789012 -> 1234-5678-9012
 */
export function formatLRN(lrn: string): string {
  if (!lrn || lrn.length !== 12) {
    return lrn;
  }
  
  return `${lrn.slice(0, 4)}-${lrn.slice(4, 8)}-${lrn.slice(8, 12)}`;
}

/**
 * Mock data for testing - Last assigned student numbers by year
 */
export const mockStudentNumberSequences: Record<number, number> = {
  2026: 247,  // Last student number: 2026-0247
  2025: 189,  // Last student number: 2025-0189
  2024: 156,  // Last student number: 2024-0156
};

/**
 * Get statistics about student numbers by year
 */
export function getStudentNumberStats(students: any[]): Record<number, number> {
  const stats: Record<number, number> = {};
  
  students.forEach(student => {
    if (student.studentNumber) {
      const parsed = parseStudentNumber(student.studentNumber);
      if (parsed) {
        stats[parsed.year] = (stats[parsed.year] || 0) + 1;
      }
    }
  });
  
  return stats;
}
