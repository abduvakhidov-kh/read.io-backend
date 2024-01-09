import express from 'express';
import WebTorrent from 'webtorrent';
import cors from 'cors';
import axios from 'axios';
import cheerio from 'cheerio';
import { fileURLToPath } from 'url';
import path, { dirname, join }  from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const client = new WebTorrent();

app.use(cors());

// Serve static files
app.use(express.static('public'));
app.use(express.static('public/books'));
app.use('/books', express.static(join(__dirname, 'public', 'books')));


// Download and store the book
app.get('/download', async (req, res) => {
  const { author, title } = req.query;
  const searchQuery = `${title}${author == undefined ? "" : " " + author} epub`;

  try {
    const searchUrl = `https://thepiratebay.party/search/${encodeURIComponent(searchQuery)}`;
    const response = await axios.get(searchUrl);
    const $ = cheerio.load(response.data);

    const magnetLinks = $('a[href^="magnet:?"]').toArray().map(element => $(element).attr('href'));

    if (magnetLinks.length > 0) {
      const magnetURI = magnetLinks[0];
      const torrent = client.add(magnetURI, { path: './public/books' });

      torrent.on('done', () => {
        res.send('Book downloaded successfully');
      });

      torrent.on('error', () => {
        res.status(500).send('Error downloading book');
      });
    } else {
      res.status(404).send('Book not found');
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/book', (req, res) => {
  const { title } = req.query;

  if (!title) {
    return res.status(400).send('Title parameter is required');
  }

  const booksDir = join(__dirname, 'public', 'books');
  const matchingEpub = findMatchingEpub(booksDir, title);

  if (!matchingEpub) {
    return res.status(404).send('Matching Epub file not found');
  }

  const matchingBookDir = join(booksDir, matchingEpub);
  const pathToBook = findMatchingBook(matchingBookDir, title);

  if (!pathToBook) {
    return res.status(404).send('Matching Epub file not found');
  }

  res.send(matchingEpub);
});

function findMatchingEpub(booksDir, title) {
  const files = fs.readdirSync(booksDir);
  const formattedTitle = title.replace(/ /g, '_'); // Replace spaces with underscores
  const matchingEpubWithUnderscore = files.find(file =>
    file.toLowerCase().includes(formattedTitle.toLowerCase())
  );

  if (matchingEpubWithUnderscore) {
    return matchingEpubWithUnderscore;
  }

  const matchingEpubWithoutUnderscore = files.find(file =>
    file.toLowerCase().includes(title.toLowerCase())
  );

  return matchingEpubWithoutUnderscore;
}

function findMatchingBook(matchingBookDir, title) {
  if (fs.statSync(matchingBookDir).isDirectory()) {
    const files = fs.readdirSync(matchingBookDir);
    const formattedTitle = title.replace(/ /g, '_'); // Replace spaces with underscores
    const matchingBookWithUnderscore = files.find(file =>
      file.toLowerCase().includes(formattedTitle.toLowerCase())
    );

    if (matchingBookWithUnderscore && matchingBookWithUnderscore.endsWith('.epub')) {
      return matchingBookWithUnderscore;
    }

    const matchingBookWithoutUnderscore = files.find(file =>
      file.toLowerCase().includes(title.toLowerCase())
    );

    if (matchingBookWithoutUnderscore && matchingBookWithoutUnderscore.endsWith('.epub')) {
      return matchingBookWithoutUnderscore;
    }
  } else if (matchingBookDir.toLowerCase().endsWith('.epub')) {
    return matchingBookDir;
  }

  return null;
}



// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
