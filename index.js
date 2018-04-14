const fs = require("fs");
const path = require("path");
const request = require("request");
const mkdirp = require("mkdirp");
const commandLineArgs = require("command-line-args");
const XLSX = require("xlsx");

const DIST = {
  path: "dist",
  filename: "articles.xlsx"
};

const optionDefinitions = [{
    name: "people",
    alias: "p",
    type: Number,
    defaultValue: 2
  },
  {
    name: "number",
    alias: "n",
    type: Number,
    defaultValue: 100
  },
  {
    name: "distribution",
    alias: "d",
    type: Distribution,
    multiple: true
  }
];

function Distribution(assign) {
  if (!(this instanceof Distribution)) return new Distribution(assign);
  const pair = assign.match(/(\d+):(\d+)/);
  this.number = parseInt(pair[1]);
  this.people = parseInt(pair[2]);
}

function shuffle(array) {
  return array
    .map(item => {
      return {
        weight: Math.random(),
        value: item
      };
    })
    .sort((a, b) => {
      return a.weight - b.weight;
    })
    .map(item => {
      return item.value;
    });
}

async function getArticlesByOrder(amount, order) {
  return new Promise((resolve, reject) => {
    request.post({
        url: "https://cofacts-api.g0v.tw/graphql",
        json: {
          query: `{
          ListArticles (first: ${amount}, orderBy: ${order}, filter: {replyCount: {EQ: 0}}) {
            edges {
              node {
                id
              }
            }
          }
        }`,
          operationName: null,
          variables: null
        }
      },
      function (error, response, body) {
        if (!error && response.statusCode == 200) {
          resolve(body.data.ListArticles.edges.map(item => item.node.id));
        } else {
          reject(error);
        }
      }
    );
  });
}

(async () => {
  const options = commandLineArgs(optionDefinitions);
  const distribution = options.distribution ?
    options.distribution : [Distribution(`${options.number}:${options.people}`)];
  const flat = distribution.reduce(
    (acc, cur) => acc.concat(Array(cur.people).fill(cur.number)), []
  );
  const amount = distribution.reduce(
    (acc, cur) => (acc += cur.number * cur.people),
    0
  );
  const newest = await getArticlesByOrder(amount, "{createdAt: DESC}");
  const mostAsked = await getArticlesByOrder(
    amount,
    "{replyRequestCount: DESC}"
  );
  const list = shuffle(
    Array.from(new Set([].concat.apply(newest, mostAsked)))
  ).slice(0, amount);

  try {
    if (list.length < amount) {
      throw new Error(
        `Only ${
          list.length
        } articles haven't replied, but you requested total ${amount} articles. Please adjsut your params.`
      );
    }
  } catch (e) {
    console.error(e);
    return;
  }

  const jsons = flat.map((num, idx) => {
    const cursor = flat.slice(0, idx).reduce((acc, cur) => (acc += cur), 0);
    return list.slice(cursor, cursor + num).map((val, idx) => ({
      ID: idx + 1,
      Link: `https://cofacts.g0v.tw/article/${val}`,
      Done: ''
    }));
  });
  const sheetNames = flat.map(
    (num, idx) => `No. ${idx + 1} (Rename tab)`
  );
  const workbook = {
    SheetNames: sheetNames,
    Sheets: sheetNames.reduce((acc, cur, idx) => {
      return Object.assign({}, acc, {
        [sheetNames[idx]]: XLSX.utils.json_to_sheet(jsons[idx])
      });
    }, {})
  };

  const timestamp = new Date()
    .toISOString()
    .replace(/:|-|T/g, "")
    .split(".")[0];
  mkdirp.sync(DIST.path);

  XLSX.writeFileAsync(
    path.resolve(DIST.path, `${timestamp}-${DIST.filename}`),
    workbook,
    () => {
      console.log("File has been saved: ");
      distribution.forEach(function (el) {
        console.log(`=> ${el.number} articles for ${el.people} people`);
      });
    }
  );
})();
