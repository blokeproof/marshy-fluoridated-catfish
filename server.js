require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
let mongoose;
try {
  mongoose = require("mongoose");
} catch (e) {
  console.log(e);
}

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

let bodyParser = require("body-parser");

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());

app.use("/public", express.static(`${process.cwd()}/public`));

app.get("/", function(req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

// Your first API endpoint
app.get("/api/hello", function(req, res) {
  res.json({ greeting: "hello API" });
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});

let urlSchema = new mongoose.Schema({
  original: { type: String, required: true },
  short: Number
});

let Url = mongoose.model("Url", urlSchema);

let shortInput = 1;

let responseObject = {};

let validURL = str => {
  let pattern = new RegExp(
    "^(https?:\\/\\/)?" + // protocol
    "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" + // domain name
    "((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
    "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // port and path
    "(\\?[;&a-z\\d%_.~+=-]*)?" + // query string
      "(\\#[-a-z\\d_]*)?$",
    "i"
  ); // fragment locator
  return !!pattern.test(str);
};

app.post(
  "/api/shorturl/new",
  bodyParser.urlencoded({ extended: false }),
  (request, response) => {
    let inputUrl = request.body["url"];
    if (inputUrl != "") {
      responseObject["original_url"] = inputUrl;

      let urlPattern = new RegExp(
        "^(https?:\\/\\/)?" + // protocol
        "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" + // domain name
        "((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
        "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // port and path
        "(\\?[;&a-z\\d%_.~+=-]*)?" + // query string
          "(\\#[-a-z\\d_]*)?$",
        "i"
      ); // fragment locator

      if (inputUrl.match(urlPattern)) {
        //check if the url already exists in the database
        const query = Url.where({ original: inputUrl });
        query.findOne(function(err, existingUrlObject) {
          if (!existingUrlObject) {
            Url.findOne({})
              .sort({ short: "desc" })
              .exec((error, result) => {
                if (!error && result != undefined) {
                  shortInput = result.short + 1;
                }
                if (!error) {
                  Url.findOneAndUpdate(
                    { original: inputUrl },
                    { original: inputUrl, short: shortInput },
                    { new: true, upsert: true },
                    (error, savedUrl) => {
                      if (!error) {
                        responseObject["short_url"] = savedUrl.short;
                        response.json(responseObject);
                      }
                    }
                  );
                }
              });
          } else if (existingUrlObject) {
            responseObject = {
              error:
                "URL already exists in short_url " + existingUrlObject.short
            };
            response.json(responseObject);
          } else {
            responseObject = { error: err };
            response.json(responseObject);
          }
        });
      } else {
        responseObject = { error: "Invalid URL" };
        response.json(responseObject);
      }
    } else {
      responseObject = { error: "Empty URL field" };
      response.json(responseObject);
    }
  }
);

app.get("/api/shorturl/:input", (request, response) => {
  let input = request.params["input"];
  Url.findOne({ short: input }, (error, result) => {
    if (!error && result != undefined) {
      response.redirect(result.original);
    } else {
      response.json({ error: "URL not found" });
    }
  });
});
