import { SalesforceData } from '../models';

// Simple in-memory cache: key = `${companyId}-${reportType}-${newsHeading}`
const reportCache = new Map<string, string>();

export const generateReportMarkdown = async (
  companyName: string,
  companyId: string,
  reportType: string
): Promise<string> => {
  try {
    // 1. Fetch historical data from the database
    const dbRecords = await SalesforceData.findAll({
      where: { companyId },
      order: [['year', 'ASC']],
    });

    const formattedDbData = dbRecords.map(record => ({
      year: record.year,
      sales: parseFloat(record.sales as any),
      profit: parseFloat(record.profit as any),
    }));

    // 2. Fetch the latest news from the API
    let newsArticle = { heading: '', content: '' };
    try {
      const newsResponse = await fetch(`https://news-api.jona-581.workers.dev/?id=${companyId}`);
      if (newsResponse.ok) {
        newsArticle = await newsResponse.json();
      }
    } catch (error) {
      console.error('Error fetching news:', error);
    }

    // 3. Cache lookup (Bonus requirement)
    const cacheKey = `${companyId}-${reportType}-${newsArticle.heading}`;
    if (reportCache.has(cacheKey)) {
      console.log(`[Cache Hit] Returning cached report for ${companyName}`);
      return reportCache.get(cacheKey)!;
    }

    // 4. Construct prompt for the Gemini LLM
    const prompt = `You are a professional financial consultant evaluating "${companyName}" (ID: ${companyId}) for potential investment.
  
Analyze the following data sources:

1. DATABASE (Historical Financials):
${JSON.stringify(formattedDbData, null, 2)}

2. NEWS API (Recent Updates):
Heading: "${newsArticle.heading}"
Content: "${newsArticle.content}"

Requirements:
- Combine both sources. Reason about the signals (e.g. good sales/profit trends but bad news, or conflicting data). Explain any uncertainty.
- If the news article contains newer financial numbers (sales/profit/losses) for a more recent period, prefer those numbers over the historical DB records.
- Support report type: "${reportType}".
  - If "${reportType}" is "high-level": Provide only a short, clear, one-to-two sentence executive summary with the final recommendation (Invest / Don't Invest / Defer).
  - If "${reportType}" is "detailed": Include structured sections (using Markdown headings) for "Executive Summary", "Sales & Profit Snapshot", "News Analysis", and a clear "Final Investment Recommendation" (Invest / Don't Invest / Defer) with reasoning.
- Output ONLY valid markdown. Do NOT wrap your output in markdown code blocks like \`\`\`markdown or \`\`\`. Start writing your markdown report immediately.`;

    // 5. Call Gemini REST API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return `### ❌ API Configuration Error\n\n\`GEMINI_API_KEY\` is not configured in the server's \`.env\` file. Please add it to start generating reports.`;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            thinkingConfig: {
              thinkingLevel: 'MINIMAL',
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson: any = {};
      try {
        errorJson = JSON.parse(errorText);
      } catch (e) {}

      const errorMsg = errorJson.error?.message || errorText;
      const isRateLimit = response.status === 429;

      if (isRateLimit) {
        return `### ⚠️ Rate Limit Exceeded\n\nThe Gemini API free-tier request limit has been reached. Please wait a few seconds and try again.\n\n*Error details: ${errorMsg}*`;
      }

      return `### ❌ Gemini API Error\n\nFailed to generate report from Gemini API.\n\n*Error details: ${errorMsg}*`;
    }

    const data = await response.json();
    let generatedMarkdown = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Clean up any potential markdown code blocks returned by the model
    generatedMarkdown = generatedMarkdown.replace(/^```markdown\n?/i, '').replace(/```$/, '').trim();

    // Save to cache
    if (newsArticle.heading) {
      reportCache.set(cacheKey, generatedMarkdown);
    }

    return generatedMarkdown;
  } catch (error: any) {
    console.error('Failed to generate report:', error);
    return `### ❌ Error Generating Report\n\nAn unexpected error occurred while generating the report. Please try again later.\n\n*Error details: ${error.message || error}*`;
  }
};
