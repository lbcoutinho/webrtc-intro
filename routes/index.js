// Express routes
module.exports = app => {
  app.get('/intro', (req, res) => {
    res.render('intro/intro.html');
  });

  app.get('/', (req, res) => {
    res.render('index.html');
  });
};
