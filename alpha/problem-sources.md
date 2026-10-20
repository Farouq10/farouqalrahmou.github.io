# Alpha daily maths bank — editorial and source notes

Prepared 20 October 2026. `math-bank.json` is a flat array of 90 unique references, with 30 items per level in rotation order. It contains original short editorial titles and broad topics, not copied problem statements, answers or solutions. Questions remain in the linked official papers. These are real competition questions, not generated substitutes.

## Selection

- Easy: Senior Mathematical Challenge 2015–2024, Q19, Q22 and Q25 from each year. All are on PDF page 4. These are relative entry-level problems for this olympiad-oriented set, and still challenging. SMC avoids repeating the user's completed IMC sets.
- Medium: BMO1 2009/10–2024/25, Q1 and Q2 from each season except 2020/21. The unusual 2020/21 pandemic paper has two independently numbered sections and is deliberately excluded.
- Hard: ten BMO1 Q4s (2014/15–2024/25 excluding 2020/21), ten BMO2 Q1/Q2s (2015–2024), ten EGMO Q1/Q2s (2015–2024). EGMO Q3 is omitted because its difficulty is often substantially higher.

The easy and medium arrays are deterministically mixed to vary years and topics. Hard alternates BMO1, BMO2 and EGMO. A 30-day rotation is a repeating cycle, not an inexhaustible supply of new questions; the UI should say so.

## Primary sources

- UKMT SMC free past-paper archive: https://ukmt.org.uk/competition-papers/jsf/jet-engine%3Afree-past-papers/tax/challenge-type%3A76/
- BMO official paper archive: https://bmos.ukmt.org.uk/home/bmo.shtml
- BMO official solution index: https://bmos.ukmt.org.uk/solutions/
- EGMO archive: https://www.egmo.org/egmos/ ; each item links its actual annual archive page.
- UKMT use policy: https://bmos.ukmt.org.uk/home/usage.shtml

UKMT retains copyright. Its policy permits discussion of individual problems but restricts systematic public analysis of multiple questions without written permission. Therefore this bank links to official papers and solutions; it does not redistribute papers or provide bulk reproduced statements or systematic solution analyses. No assertion of permission to republish complete papers is made.

## Verification

All selected BMO and EGMO paper PDFs were successfully fetched from their official hosts and the selected question text was inspected. All selected SMC papers and official solutions were retrieved through the web search reader from the actual official archive links; their selected question numbers were inspected. Direct Python requests to `ukmt.org.uk` returned HTTP 503 in this environment, so the SMC papers were verified through the web reader rather than falsely recorded as passing a direct HTTP check. The official URLs can be temporarily unavailable and are outside Alpha's control. The interface should retain a link to the relevant archive as a fallback.

Page numbers are one-based PDF page numbers. BMO page numbers were derived from extracted PDF page breaks and selected question starts. EGMO day-one papers are one page; SMC selected questions are on page 4. Add `#page=N` to the paper link in the UI if desired.

BMO1 filenames use the *end* of the academic year: `bmo1-2025.pdf` was sat in November 2024. Therefore `year` is the actual calendar year, `season` is `2024/2025`, and `archiveYear` is 2025. Display the season for BMO1. BMO2 calendar year and filename year coincide. IDs intentionally follow official filename years.

Official BMO1 solution pages provide videos, rather than written PDF solutions. The official BMO2 index provides solutions from 2024; the paper archive also provides written solutions for 2021 and 2022. Seven older selected BMO2 questions have no `solutionUrl`, because no free official solution URL was verified. Do not invent a solution button for these. EGMO solution PDFs are linked from each annual official archive; 2019 uses the separate day-one solution PDF.

Validation checks: 90 records; exactly 30 per level; unique IDs and unique competition/year/question tuples; all paper URLs HTTPS; selected question ranges obey the requested competition bands. `math-solution-link-checks.json` records direct checks of BMO/EGMO solution URLs. Supporting research and downloaded source papers are inspection-only scratch material and should not be copied into the site's public files.
