const fs = require('fs')
const path = require('path')
const request = require('request')

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

async function getArticlesByOrder (order) {
  return new Promise((resolve, reject) => {
    request.post({
      url: 'https://cofacts-api.g0v.tw/graphql',
      json: {
        query: `{
          ListArticles (first: 100, orderBy: ${order}, filter: {replyCount: {EQ: 0}}) {
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
  const newest = await getArticlesByOrder('{createdAt: DESC}')
  const mostAsked = await getArticlesByOrder('{replyRequestCount: DESC}')
  const list = shuffle(Array.from(new Set([].concat.apply(newest, mostAsked))))
  const csv = list.reduce((acc, val, idx) => {
    return acc.concat(idx, ', ', `https://cofacts.g0v.tw/article/${val}`, '\n')
  }, 'ID, Link\n');
  fs.writeFile('articles.csv', csv, (err) => {
   if (err) throw err;
    console.log('The file has been saved!');
  })
})()
