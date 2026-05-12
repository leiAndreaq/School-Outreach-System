# ThinkTANQ AI School Outreach MVP

This is a beginner-friendly starter system for interns.

## What it does

- Add private school leads
- Import school leads by CSV
- Generate proposal emails
- Generate follow-up emails
- Generate meeting invitation emails
- Track lead status
- Store email drafts
- Run in FREE TEMPLATE MODE without paid API
- Upgrade later to OpenAI API mode by adding an API key

## Install

1. Install Node.js.
2. Open terminal in this folder.
3. Run:

```bash
npm install
```

4. Copy `.env.example` to `.env`.

```bash
copy .env.example .env
```

For Mac/Linux:

```bash
cp .env.example .env
```

5. Start the system:

```bash
npm start
```

6. Open browser:

```text
http://localhost:3000
```

## Free mode

Leave `OPENAI_API_KEY=` blank in `.env`.

The system will use built-in templates.

## Upgrade mode

Add your OpenAI API key in `.env`:

```env
OPENAI_API_KEY=your_key_here
```

Then the AI will generate more customized emails.

## Safety

Keep `DRAFT_MODE=true` while interns are testing.

Do not enable automatic sending until approved by management.
