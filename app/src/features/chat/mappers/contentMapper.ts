export function mapToContentParts(content: string): MessagePart[] {
	const parts = [];
	const lines = content.split("\n");

	let i = 0;
	while (i < lines.length) {

		if (isNumberedPoint(lines[i])) {
			const numberedPoints = extractNumberedPoints(lines.filter((line, idx) => idx >= i));
			parts.push({
				type: "OrderedList",
				numberedPoints,
			} as OrderedList);
			i += numberedPoints.length;
		}

		if (isCodeMarker(lines[i])) {
			const language = extractLanguage(lines[i]);
			const codeLines = extractCodeLines(lines.filter((_, idx) => idx > i));
			const code = codeLines.join("\n");

			parts.push({
				type: "CodeSnippet",
				language,
				code
			} as CodeSnippet);

			i += codeLines.length + 2;
		}

		if (i < lines.length) {
			parts.push({
				type: "Paragraph",
				text: clean(lines[i])
			} as Paragraph);
		}

		i++;
	}

	//console.log("parts", parts);

	return parts;
}

function isNumberedPoint(line: string): boolean {
	return /^\d+\.\s/.test(line);
}

function isCodeMarker(line: string): boolean {
	return /^```(?:bash|c|cpp|csharp|css|html|java|javascript|jsx|markup|python|rust|swift|toml|tsx|typescript)/.test(line);
}

function extractNumberedPoints(lines: string[]): string[] {
	const numberedPoints: string[] = [];
	let i = 0;
	while (isNumberedPoint(lines[i])) {
		numberedPoints.push(lines[i]);
		i++;
	}
	return numberedPoints;
}

function extractLanguage(line: string): string {
	return line
		.replace("```", "")
		.replace("language-", "")
		.toLowerCase();
}

function extractCodeLines(lines: string[]): string[] {
	const codeLines: string[] = [];
	let i = 0;
	while (!lines[i].startsWith("```") && i < lines.length) {
		codeLines.push(lines[i]);
		i++;
	}
	return codeLines;
}

function clean(line: string): string {
	return line
		.replace("```language", "")
		.replace("```", "");
}