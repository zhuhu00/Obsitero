import fs from "node:fs/promises";

export async function loadAiContext(job) {
  const [rawNoteContent, templateContent] = await Promise.all([
    fs.readFile(job.note_path, "utf8"),
    fs.readFile(job.note_template_path, "utf8"),
  ]);

  return {
    noteContent: stripManagedAiBlock(rawNoteContent),
    templateContent,
    pdfPath: job.codex_pdf_path || job.pdf_path || "",
  };
}

export function buildAiPrompt({ noteContent, templateContent, pdfPath }) {
  return `
You are generating a managed Obsitero AI note block for one paper.

Hard requirements:
- Return ONLY markdown content starting with "# AI Notes"
- Output exactly one "# AI Notes" heading, only at the beginning
- Do NOT include code fences
- Do NOT include <!-- OBSITERO-AI-START --> or <!-- OBSITERO-AI-END -->
- Write in concise Chinese
- Use tools only to read and inspect the PDF file named below.
- Do not modify files.
- Do not ask follow-up questions.
- Keep the section order aligned with the template.
- If information is missing, say "未提及" instead of fabricating details.
- If figures cannot be inspected reliably, keep image embeds empty and explain the figure from the paper text when possible.

PDF file to analyze:
<pdf_path>
${pdfPath}
</pdf_path>

Current paper note:
<current_note>
${noteContent.trim()}
</current_note>

AI note template:
<ai_note_template>
${templateContent.trim()}
</ai_note_template>

Return only the final markdown block.
  `.trim();
}

export function stripManagedAiBlock(markdown) {
  return markdown
    .replace(
      /<!-- OBSITERO-AI-START -->[\s\S]*?<!-- OBSITERO-AI-END -->\n*/m,
      "",
    )
    .trim();
}
