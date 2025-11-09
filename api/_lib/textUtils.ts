/**
 * Splits a long string of text into smaller chunks of a specified size,
 * attempting to split at natural sentence breaks for better TTS synthesis.
 * @param text The text to split.
 * @param chunkSize The maximum size of each chunk.
 * @returns An array of text chunks.
 */
export function smartSplit(text: string, chunkSize: number): string[] {
    if (text.length <= chunkSize) {
        const trimmed = text.trim();
        return trimmed ? [trimmed] : [];
    }

    const chunks: string[] = [];
    let remainingText = text;

    while (remainingText.length > 0) {
        if (remainingText.length <= chunkSize) {
            const trimmed = remainingText.trim();
            if (trimmed) chunks.push(trimmed);
            break;
        }

        let slicePoint = chunkSize;
        let splitIndex = -1;

        // Prefer to split at sentence endings (., !, ?, newlines)
        const sentenceBreaks = ['.', '!', '?', '\n', '。', '！', '？'];
        for (const breakChar of sentenceBreaks) {
            // Search backwards from the chunkSize limit
            const lastIndex = remainingText.substring(0, chunkSize).lastIndexOf(breakChar);
            if (lastIndex > splitIndex) {
                splitIndex = lastIndex;
            }
        }
        
        // If no sentence break is found, try to split at a space
        if (splitIndex === -1) {
            splitIndex = remainingText.substring(0, chunkSize).lastIndexOf(' ');
        }
        
        // If a good split point was found, use it. Otherwise, hard cut at chunkSize.
        if (splitIndex !== -1 && splitIndex > 0) {
            // +1 to include the break character in the chunk
            slicePoint = splitIndex + 1;
        }
        
        const chunk = remainingText.substring(0, slicePoint).trim();
        if (chunk) {
            chunks.push(chunk);
        }
        remainingText = remainingText.substring(slicePoint);
    }
    return chunks;
}
