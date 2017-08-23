const fs = require('fs')
const path = require('path')
const request = require('request')
const mkdirp = require('mkdirp')
const commandLineArgs = require('command-line-args')

const DIST = {
  path: 'dist',
  filename: 'articles.csv'
}

const optionDefinitions = [
  { name: 'number', alias: 'n', type: Number }
]

function shuffle (array) {
  return array.map((item) => {
    return {
      weight: Math.random(),
      value: item
    }
  }).sort((a, b) => {
    return a.weight - b.weight
  }).map((item) => {
    return item.value
  })
}


async function getArticlesByOrder (amount, order) {
  return new Promise((resolve, reject) => {
    request.post({
      url: 'https://cofacts-api.g0v.tw/graphql',
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
    }, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        resolve(body.data.ListArticles.edges.map(item => item.node.id))
      } else {
        reject(error)
      }
    })
  })
}

(async () => {
  const options = commandLineArgs(optionDefinitions)
  const amount =  Number.isInteger(options.number) || 100
  const newest = await getArticlesByOrder(amount, '{createdAt: DESC}')
  const mostAsked = await getArticlesByOrder(amount, '{replyRequestCount: DESC}')
  const list = shuffle(Array.from(new Set([].concat.apply(newest, mostAsked).slice(0, amount))))
  const csv = list.reduce((acc, val, idx) => {
    return acc.concat(idx, ', ', `https://cofacts.g0v.tw/article/${val}`, '\n')
  }, 'ID, Link\n');

  mkdirp.sync(DIST.path)

  fs.writeFile(path.resolve(DIST.path, DIST.filename), csv, (err) => {
   if (err) throw err
    console.log('The file has been saved!')
  })
})()
