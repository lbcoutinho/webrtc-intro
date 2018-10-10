const express = require('express');
const path = require('path');
const app = express();

// Public folder and HTML render engine setup
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'public'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.get('/intro', (req, res) => {
  res.render('intro/intro.html');
});

app.get('/', (req, res) => {
  res.render('index.html');
});

const port = 3000;
app.listen(port, () => console.log(`Server started on port ${port}`));
