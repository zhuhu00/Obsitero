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
    figureAssetDir: job.figure_asset_dir || "",
    teaserImagePath: job.teaser_image_path || "",
    pipelineImagePath: job.pipeline_image_path || "",
    teaserMarkdownEmbed: job.teaser_markdown_embed || "![]()",
    pipelineMarkdownEmbed: job.pipeline_markdown_embed || "![]()",
  };
}

export function buildAiPrompt({
  noteContent,
  templateContent,
  pdfPath,
  figureAssetDir = "",
  teaserImagePath = "",
  pipelineImagePath = "",
  teaserMarkdownEmbed = "![]()",
  pipelineMarkdownEmbed = "![]()",
}) {
  return `
You are generating a managed Obsitero AI note block for one paper.

Hard requirements:
- Return ONLY markdown content starting with "# AI Notes"
- Output exactly one "# AI Notes" heading, only at the beginning
- Do NOT include code fences
- Do NOT include <!-- OBSITERO-AI-START --> or <!-- OBSITERO-AI-END -->
- Write in concise Chinese
- Use tools to read and inspect the PDF file named below.
- Do not create, overwrite, or modify image files.
- Do not modify any files.
- Do not ask follow-up questions.
- Keep the section order aligned with the template.
- If information is missing, say "未提及" instead of fabricating details.
- Identify a teaser/overview figure and a pipeline/architecture/method figure when possible.
- Prefer explicit Figure/Fig. numbers in the Teaser and Pipeline explanations.
- In "## 关键图表", leave image embed lines empty as "![]()"; the local watcher will replace them after deterministic extraction succeeds.
- If a figure cannot be identified reliably, keep the embed empty as "![]()" and explain "未提及" or the reason.

PDF file to analyze:
<pdf_path>
${pdfPath}
</pdf_path>

Local figure extraction outputs for watcher context only:
<figure_outputs>
asset_dir: ${figureAssetDir}
teaser_image_path: ${teaserImagePath}
teaser_markdown_embed: ${teaserMarkdownEmbed}
pipeline_image_path: ${pipelineImagePath}
pipeline_markdown_embed: ${pipelineMarkdownEmbed}
</figure_outputs>

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
