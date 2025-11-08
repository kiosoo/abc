import { TimedWord } from '@/types';

/**
 * Parses a time string from the API (e.g., "0.123s") into seconds.
 * @param timeString The time string to parse.
 * @returns The time in seconds as a number.
 */
const parseTime = (timeString: string): number => {
    if (!timeString || !timeString.endsWith('s')) return 0;
    return parseFloat(timeString.slice(0, -1));
};

/**
 * Formats a total number of seconds into the SRT timestamp format HH:MM:SS,ms.
 * @param totalSeconds The total seconds to format.
 * @returns A string in SRT timestamp format.
 */
export const formatSrtTimestamp = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    const milliseconds = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000).toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds},${milliseconds}`;
};

/**
 * Creates the full content of an SRT file from an array of timed words.
 * @param words An array of TimedWord objects with adjusted timestamps.
 * @returns A string representing the content of an SRT file.
 */
export const createSrtContent = (words: TimedWord[]): string => {
    if (!words || words.length === 0) return '';

    const wordsPerLine = 10;
    const lines: TimedWord[][] = [];
    let currentLine: TimedWord[] = [];

    // Group words into lines for the subtitle file
    words.forEach(word => {
        currentLine.push(word);
        // Create a new line if it reaches the word limit or ends with punctuation
        if (currentLine.length >= wordsPerLine || /[.?!]$/.test(word.word.trim())) {
            lines.push(currentLine);
            currentLine = [];
        }
    });

    // Add any remaining words as the last line
    if (currentLine.length > 0) {
        lines.push(currentLine);
    }

    // Format each line into the SRT block format
    return lines.map((line, index) => {
        const startTime = parseTime(line[0].startTime);
        const endTime = parseTime(line[line.length - 1].endTime);
        const text = line.map(w => w.word).join(' ');

        return `${index + 1}\n${formatSrtTimestamp(startTime)} --> ${formatSrtTimestamp(endTime)}\n${text}\n`;
    }).join('\n');
};
