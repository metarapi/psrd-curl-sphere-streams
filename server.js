import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3004;

const repoBasePath = '/psrd-curl-sphere-streams/';

app.use(express.static(path.join(__dirname, 'dist')));
app.use(repoBasePath, express.static(path.join(__dirname, 'dist')));

// SPA fallback for client-side routing — serve index.html for unknown
// routes. Use a regex-based route to avoid path parsing issues.
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Also serving build under ${repoBasePath}/`);
});