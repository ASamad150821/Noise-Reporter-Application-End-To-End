import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { resolve } from 'path';

const app = express();
app.use(express.json());

const DB_PATH = resolve('server/reports.json');

function loadReports(): object[] {
    if (!existsSync(DB_PATH)) return [];
    return JSON.parse(readFileSync(DB_PATH, 'utf-8'));
}

function saveReports(reports: object[]) {
    writeFileSync(DB_PATH, JSON.stringify(reports, null, 2));
}

app.post('/api/submitCase', (req, res) => {
    const { firstName, lastName, email, noiseType, howLong, description } = req.body;
    const caseReference = `NR-${randomUUID().slice(0, 8).toUpperCase()}`;
    const report = { caseReference, firstName, lastName, email, noiseType, howLong, description, submittedAt: new Date().toISOString() };

    console.log('New report received:', report);

    const reports = loadReports();
    reports.push(report);
    saveReports(reports);

    res.status(201).json({ caseReference });
});

app.listen(3001, () => console.log('Server running on http://localhost:3001'));
