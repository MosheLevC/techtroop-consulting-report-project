# Running the project

- Make sure you have node version 20 or greater
- Ensure `concurrently` is installed (`npm install concurrently --save-dev`)
- Run `npm i`
- Create a `.env` file in your `/server` directory and add the `DATABASE_URL=...` provided by the instructor
- Run `npm run dev` - runs the front and backend concurrently with hot module
  and auto server reload. Note that you need to run this in the **root** of your project
- See the UI at [http://localhost:5173/](http://localhost:5173/)

# Exercise: Investment Report Generator

## Overview

You are a consultant at a firm that evaluates companies for potential
investment.  
Your task is to implement a backend service that generates a **Markdown
investment report** for a selected company.

The backend will pull data from two sources:

- **Database (DB):** Aggregated sales and profit data from last year.
- **API:** News articles about the company (may include more recent sales/profit
  figures than the DB).

The LLM must **combine both sources**, reason about the signals, and generate a
clear investment recommendation.  
Example logic:

- Good sales + good profit + good news → _Invest_
- Good sales + good profit + bad news → _Don't invest/defer investment_
- Conflicting or missing data → _Explain uncertainty clearly_

The frontend is already fully provided

---

## Setup

You need two resources, the DB and the API

**Connecting to the DB**

- Add a `.env` file in your `/server` directory with this:
  `DATABASE_URL=postgresql://workshop_readonly.qokkrimhprtufpqcpvmm:THE_DB_PASSWORD@aws-1-eu-central-1.pooler.supabase.com:6543/postgres`
- Replace `THE_DB_PASSWORD` with the password provided by the instructor
- You can access the DB using the provided `SalesforceData` model (see
  `SalesforceData.ts`). Example usage:

```
    const allCompaniesData = await SalesforceData.findAll({})
```

**API Endpoint**

- Access the API by making a request to
  `https://news-api.jona-581.workers.dev/?id=COMPANY_ID`
- Replace COMPANY_ID with the `companyId` field received in
  `generateReportMarkdown`

### LLM via API

You will also need API access to an LLM. You can use any you like, but if you
want something for free (with rate limiting), you can use Google's Gemini

- Here is a simple guide to setting it up:
  https://ai.google.dev/gemini-api/docs/quickstart#javascript
- You will need an API key which you can get for free here:
  https://aistudio.google.com/app/apikey?
  - Press the `Create API Key` button on the top right
- **Note** as per the Gemini documentation, you can reduce token usage (hence
  increase your rate limit) by disabling thinking. For this project, it's safe
  to turn thinking off.
  - To turn thinking off, add the following to your API request:

```
    config: {
      thinkingConfig: {
        thinkingBudget: 0, // Disables thinking
      },
    }
```

- Whichever LLM you use, you will likely need to add its API key to the `.env`
  file as well (gemini expects a `GEMINI_API_KEY` in your env)

---

## Requirements

1. **Fetch company data**

   - From DB: last year's aggregated sales & profit.
   - From API: recent news headlines (and sometimes updated financials).
   - If API has newer numbers than DB, prefer API.

2. **Prompt the LLM**

   - Ask the LLM to produce a **Markdown report** including:
     - Executive summary
     - Sales & profit snapshot
     - News analysis
     - Final investment recommendation (Invest / Don't Invest / Defer)

3. **Support two report modes**

   - **High-level**: A short sentence with a final recommendation
   - **Detailed**: A heading section for each of the financial/news data
     summaries, with the relevant data

4. **Return LLM output to the UI**.

   - The UI is already setup to render markdown properly
   - Ensure you only send the markdown string to the UI

5. **Where to start**

   - Your only concern is the `reportService.ts` file
   - You have a `generateReportMarkdown` there which gets called when the user
     presses the **Generate Report** button
   - Implement your work in this file (of course, I recommend you work
     modularly; a separate service for your LLM, API, DB, etc...)

**Bonus**

- The news API returns a random article for each company each time (which will
  affect the model's decision)
- This randomness simulates news staying "fresh"
- However, some news is "stale" (articles you've seen before) and the data in
  the DB is fixed
- As such, to save on tokens you can cache the model's output report when you
  get the same article title
  - Why? If you get the same article, the model should give the same
    recommendation - no need to call the LLM again and burn tokens!

## Pro tip

Check the data before you begin your actual work! In the real world there are
almost always discrepancies between the project requirements and the actual
real-world data you end up working with. Trust me

## Result

**High level report example**
<img width="989" height="543" alt="image" src="https://github.com/user-attachments/assets/3282f4d9-723b-4520-bdd7-7a70de750e1f" />

**Detailed report example**
<img width="989" height="872" alt="image" src="https://github.com/user-attachments/assets/af6abb47-2198-42c7-8b4a-8d7c958c654e" />
