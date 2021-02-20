const express = require('express');
const webScrapping = require('./webScrapping');

const app = express();
app.use(express.json());

let data = null;

app.get('/', async (request, response) => {
  if (data === null) {
    data = await webScrapping.execute();
  }

  return response.json(data);
})

app.listen(process.env.PORT || 3000);