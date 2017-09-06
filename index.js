const fs = require('fs')
const path = require('path')
const request = require('request')
const mkdirp = require('mkdirp')
const commandLineArgs = require('command-line-args')
const XLSX = require('xlsx')

const DIST = {
  path: 'dist',
  filename: 'articles.xlsx'
}

const optionDefinitions = [
  { name: 'people', alias: 'p', type: Number },
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
  const number = Number.isInteger(options.number) ? options.number : 100
  const people = Number.isInteger(options.number) ? options.people : 2
  const amount = people * number
  const newest = await getArticlesByOrder(amount, '{createdAt: DESC}')
  const mostAsked = await getArticlesByOrder(amount, '{replyRequestCount: DESC}')
  const list = shuffle(Array.from(new Set([].concat.apply(newest, mostAsked)))).slice(0, amount)
  const jsons = [...Array(people).keys()]
    .map((idx) => list.slice(idx * number, (idx + 1) * number)
      .map((val, idx) => ({
        ID: idx + 1,
        Link: `https://cofacts.g0v.tw/article/${val}`
      })
    )
  )
  const sheetNames = [...Array(people).keys()].map(idx => `No. ${idx + 1}`)
  const workbook = {
    SheetNames: sheetNames,
    Sheets: sheetNames.reduce((acc, cur, idx) => {
      return Object.assign({}, acc, {[sheetNames[idx]]: XLSX.utils.json_to_sheet(jsons[idx])})
    }, {})
  }
  const timestamp = new Date().toISOString().replace(/:|-|T/g, '').split('.')[0]
  mkdirp.sync(DIST.path)

  XLSX.writeFileAsync(path.resolve(DIST.path, `${timestamp}-${DIST.filename}`), workbook, () => {
    console.log('File has been saved!')
  });
})()
