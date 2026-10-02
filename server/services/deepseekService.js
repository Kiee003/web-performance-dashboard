const OpenAI = require('openai');
const config = require('../config');

class DeepSeekService {
    constructor() {
        this.apiKey = config.deepseekApiKey;

        if (!this.apiKey) {
            console.log('⚠️ No DeepSeek API key found in server/.env — using fallback analysis');
            console.log('   To enable AI, add: DEEPSEEK_API_KEY=your_key_here');
            this.client = null;
            return;
        }

        try {
            this.client = new OpenAI({
                baseURL: 'https://api.deepseek.com',
                apiKey: this.apiKey,
                timeout: 60000
            });
            console.log('✅ DeepSeek AI client initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize DeepSeek client:', error.message);
            this.client = null;
        }
    }

    async generateInsights(metrics, url) {
        console.log('\n🤖 ========================================');
        console.log('🤖 Generating REAL AI insights for:', url);
        console.log('🤖 ========================================\n');

        if (!this.client) {
            console.log('⚠️ AI not available - using fallback');
            return this.getIntelligentFallback(metrics);
        }

        try {
            const prompt = this.createDetailedPrompt(metrics, url);

            console.log('📡 Calling DeepSeek API (this may take 5-10 seconds)...');
            const startTime = Date.now();

            const response = await this.client.chat.completions.create({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: `You are a web performance expert giving honest, direct feedback to a website owner.

RULES:
- Be specific — always reference the exact numbers given to you
- Write naturally, like you're talking to a non-technical person
- If something is genuinely good, say so; if it is bad, be direct about the real-world impact
- Do NOT use generic advice like "compress images" unless the metrics actually show an image problem
- Every analysis must reflect the specific numbers, not a template

You must respond ONLY with a valid JSON object. No preamble, no markdown fences, no explanation outside the JSON.

The JSON must follow this exact structure:
{
  "summary": "3-4 paragraph honest analysis of what these metrics mean for real visitors. Reference exact numbers. Explain the cause, not just the symptom.",
  "verdict": "One sentence overall verdict, e.g. 'This site is fast and well-optimised.' or 'This site will frustrate most visitors.'",
  "recommendations": [
    {
      "issue": "Short title of the problem",
      "severity": "critical | warning | info",
      "plainEnglish": "What this means for a real visitor in 1-2 sentences",
      "simpleSuggestion": "The single most impactful fix for this specific metric value",
      "actionItems": ["Specific step 1", "Specific step 2", "Specific step 3"]
    }
  ]
}

The recommendations array should contain ONLY issues that are actually present in the metrics. If the site performs well on a metric, do not include it as a problem. Maximum 4 recommendations.`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.8,
                max_tokens: 1500
            });

            const endTime = Date.now();
            console.log(`✅ AI response received in ${(endTime - startTime) / 1000} seconds`);

            const aiContent = response.choices[0].message.content;
            const parsedResult = this.parseAIResponse(aiContent);
            console.log('✅ AI analysis completed successfully');

            return parsedResult;

        } catch (error) {
            console.error('❌ DeepSeek API error:', error.message);
            if (error.response) {
                console.error('   Status:', error.response.status);
                console.error('   Error details:', JSON.stringify(error.response.data, null, 2));
            }
            console.log('⚠️ Falling back to intelligent analysis based on metrics');
            return this.getIntelligentFallback(metrics);
        }
    }

    createDetailedPrompt(result, url) {
        const score = result.scores?.performance;
        const m = result.metrics || {};
        const st = result.settings || {};
        const rel = result.reliability || { level: 'ok', notes: [] };

        // null = Lighthouse could not measure it — say so, never invent a number
        const secs = (ms) => (ms === null || ms === undefined ? 'NOT MEASURED' : `${(ms / 1000).toFixed(2)}s`);
        const clsTxt = m.cls === null || m.cls === undefined ? 'NOT MEASURED' : m.cls.toFixed(3);

        let rating = 'Unknown';
        if (score !== null && score !== undefined) {
            if (score >= 90) rating = 'Excellent';
            else if (score >= 70) rating = 'Good';
            else if (score >= 50) rating = 'Average';
            else if (score >= 30) rating = 'Poor';
            else rating = 'Critical';
        }

        const device = st.formFactor === 'desktop'
            ? 'Desktop (fast connection, no CPU slowdown)'
            : 'Mobile (simulated slow 4G network and 4x slower CPU — the same as PageSpeed Insights)';

        const runsTxt = (result.runs?.count || 1) > 1
            ? `Median of ${result.runs.count} runs (individual scores: ${result.runs.scores.join(', ')})`
            : 'Single run';

        let reliabilityTxt = '';
        if (rel.level !== 'ok') {
            reliabilityTxt = `

DATA RELIABILITY: ${rel.level.toUpperCase()}
${rel.notes.map(n => '- ' + n).join('\n')}
${rel.level === 'unreliable'
    ? 'IMPORTANT: Do NOT present the affected values as real visitor experience. State clearly that they are a measurement problem, explain the likely cause from the notes above, and base your advice only on the trustworthy metrics. Your first recommendation must be about fixing the measurement (for example re-testing a production build).'
    : 'Mention this caveat briefly where relevant.'}`;
        }

        return `Here are the real Lighthouse audit results for ${url}:

Test conditions: ${device}. ${runsTxt}. Lighthouse ${st.lighthouseVersion || 'unknown'}.

Performance Score: ${score ?? 'NOT AVAILABLE'}/100 (${rating})
Largest Contentful Paint (LCP): ${secs(m.lcp)} — target under 2.5s
First Contentful Paint (FCP): ${secs(m.fcp)} — target under 1.8s
Speed Index: ${secs(m.si)} — target under 3.4s
Cumulative Layout Shift (CLS): ${clsTxt} — target under 0.1
Total Blocking Time (TBT): ${secs(m.tbt)} — target under 0.2s
Server response time (TTFB): ${secs(m.ttfb)} — target under 0.6s
Total Network Requests: ${result.requests?.total ?? 'NOT MEASURED'} — guideline under 50${reliabilityTxt}

Analyse these results honestly. Only flag metrics that are actually failing their targets. Metrics marked NOT MEASURED must not be discussed as if they had a value. If the site does well on something, acknowledge it. Be specific to these exact numbers.`;
    }

    parseAIResponse(aiContent) {
        try {
            // Strip markdown fences if present
            const clean = aiContent
                .replace(/```json/gi, '')
                .replace(/```/g, '')
                .trim();

            const parsed = JSON.parse(clean);

            // Validate required fields exist
            if (!parsed.summary || !parsed.recommendations) {
                throw new Error('Missing required fields in AI response');
            }

            return {
                summary: parsed.summary,
                verdict: parsed.verdict || '',
                recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
                generatedAt: new Date().toISOString(),
                isRealAI: true
            };

        } catch (err) {
            console.error('⚠️ Failed to parse AI JSON response:', err.message);
            console.log('Raw AI content:', aiContent.substring(0, 300));

            // If JSON parse fails, use the raw text as summary
            return {
                summary: aiContent.trim(),
                verdict: '',
                recommendations: [],
                generatedAt: new Date().toISOString(),
                isRealAI: true,
                parseError: true
            };
        }
    }

    getIntelligentFallback(result) {
        const score = result.scores?.performance ?? 0;
        const m = result.metrics || {};
        // Missing values are treated as "not failing" so no advice is invented for them
        const lcp = (m.lcp ?? 0) / 1000;
        const cls = m.cls ?? 0;
        const tbt = (m.tbt ?? 0) / 1000;
        const requests = result.requests?.total ?? 0;
        const reliability = result.reliability || { level: 'ok', notes: [] };

        let summary = '';
        let verdict = '';
        const recommendations = [];

        if (score >= 90) {
            summary = `With a score of ${score}/100, this site loads fast and performs well across all metrics. The main content appears in ${lcp.toFixed(1)} seconds, which is comfortably within the 2.5s target. Visitors are unlikely to experience frustration or delays. The page layout is stable${cls < 0.1 ? ', with no unexpected shifts' : ''}.`;
            verdict = 'This site is fast and well-optimised — keep it up.';
        } else if (score >= 70) {
            summary = `A score of ${score}/100 is above average, but there is room to improve. The main content loads in ${lcp.toFixed(1)} seconds — just ${lcp > 2.5 ? 'above' : 'within'} the 2.5s target. Most visitors will find the site usable, but those on slower connections may notice delays. With ${requests} network requests, reducing file count could make a noticeable difference.`;
            verdict = 'Decent performance, but some targeted fixes could make a real difference.';
        } else if (score >= 50) {
            summary = `A score of ${score}/100 means visitors are experiencing real delays. The main content takes ${lcp.toFixed(1)} seconds to appear — that is ${(lcp - 2.5).toFixed(1)} seconds over the target. Studies show that 53% of mobile visitors leave if a page takes over 3 seconds. With ${requests} files loading, there are likely several opportunities to speed things up.`;
            verdict = 'Performance needs attention — visitors are likely leaving before the page loads.';
        } else {
            summary = `A score of ${score}/100 is critically low. Visitors wait ${lcp.toFixed(1)} seconds to see any meaningful content — that is roughly ${Math.round(lcp / 2.5)}x longer than the recommended target. At this speed, the majority of visitors will abandon the page entirely. The ${requests} network requests and ${tbt > 0 ? tbt.toFixed(1) + 's of blocking time' : 'heavy JavaScript load'} are major contributors to this.`;
            verdict = 'This site is critically slow — most visitors will leave before it finishes loading.';
        }

        if (reliability.level === 'warning') {
            summary += `\n\nNote: ${reliability.notes.join(' ')}`;
        }

        // When the measurement itself is unreliable, say so before anything else
        if (reliability.level === 'unreliable') {
            summary = `Some of these results could not be measured reliably, so they should not be read as what real visitors experience. ${reliability.notes.join(' ')} Re-test before acting on the numbers — ideally against a production build of the site.\n\n` + summary;
            verdict = 'The measurement for this page is unreliable — re-test before drawing conclusions.';
            recommendations.push({
                issue: 'Measurement is unreliable',
                severity: 'warning',
                plainEnglish: 'Lighthouse could not measure this page cleanly, so some numbers are distorted.',
                simpleSuggestion: 'Re-run the audit against a production build, with several runs, and compare with the full Lighthouse report.',
                actionItems: [
                    'Build the site for production (e.g. npm run build) instead of using a development server',
                    'Run the audit again with 3 or 5 runs',
                    'Open the full Lighthouse report to see which request or element caused the problem'
                ]
            });
        }

        // Only add recommendations for metrics that are actually failing
        if (lcp > 2.5 && reliability.level !== 'unreliable') {
            recommendations.push({
                issue: `Main content loads in ${lcp.toFixed(1)}s`,
                severity: lcp > 4 ? 'critical' : 'warning',
                plainEnglish: `Visitors wait ${lcp.toFixed(1)} seconds to see your main content. Most expect it in under 2.5 seconds.`,
                simpleSuggestion: lcp > 6 ? 'A large hero image is the most likely cause. Compressing it could cut seconds off your load time.' : 'Optimise your largest above-the-fold image — compress it and consider WebP format.',
                actionItems: [
                    'Identify the largest image or element on your page',
                    'Compress images using TinyPNG or Squoosh (free tools)',
                    'Convert images to WebP format for smaller file sizes',
                    'Preload your main image using <link rel="preload">'
                ]
            });
        }

        if (cls > 0.1) {
            recommendations.push({
                issue: `Layout shifts by ${cls.toFixed(3)} during load`,
                severity: cls > 0.25 ? 'critical' : 'warning',
                plainEnglish: `Your page layout jumps around as it loads. Visitors try to tap a button and something else appears instead — a frustrating experience.`,
                simpleSuggestion: 'Add explicit width and height attributes to all images and reserve space for ads or embeds.',
                actionItems: [
                    'Add width and height to every <img> tag on your page',
                    'Reserve space for ads and embeds before they load',
                    'Avoid injecting content above existing text with JavaScript',
                    'Use CSS aspect-ratio boxes for videos and iframes'
                ]
            });
        }

        if (tbt > 0.2) {
            recommendations.push({
                issue: `Page is unresponsive for ${tbt.toFixed(1)}s`,
                severity: tbt > 1 ? 'critical' : 'warning',
                plainEnglish: `After loading, the page freezes for ${tbt.toFixed(1)} seconds where clicks and taps do nothing. This is caused by heavy JavaScript running on load.`,
                simpleSuggestion: 'Defer non-essential JavaScript so it loads after the page is interactive.',
                actionItems: [
                    'Add defer or async attributes to non-critical <script> tags',
                    'Remove unused JavaScript plugins and libraries',
                    'Split large JS bundles into smaller lazy-loaded chunks',
                    'Profile your JS in Chrome DevTools to find the heaviest tasks'
                ]
            });
        }

        if (requests > 80) {
            recommendations.push({
                issue: `${requests} files downloaded on load`,
                severity: requests > 120 ? 'critical' : 'warning',
                plainEnglish: `Your page makes ${requests} separate network requests. Each one adds a small delay — combined, they add up significantly, especially on mobile.`,
                simpleSuggestion: 'Combine CSS files, remove unused plugins, and use icon sprites instead of individual icon files.',
                actionItems: [
                    'Audit and remove unused plugins or third-party scripts',
                    'Combine multiple CSS files into one',
                    'Use an icon font or SVG sprite instead of separate icon images',
                    'Enable HTTP/2 on your server for parallel request handling'
                ]
            });
        }

        return {
            summary,
            verdict,
            recommendations,
            generatedAt: new Date().toISOString(),
            isRealAI: false,
            note: 'AI service unavailable — analysis generated from metrics'
        };
    }
}

module.exports = new DeepSeekService();