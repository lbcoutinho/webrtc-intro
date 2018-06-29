const express = require('express');
const app = express();

app.use(express.static(__dirname + '/public'));

app.get('/', (red, res) => {
  res.render('index.ejs');
});

const port = 3000;
app.listen(port, () => console.log(`Server started on port ${port}`));