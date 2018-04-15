exports.shuffle = (array) => {
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
};

exports.isURL = (string) => {
  return /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/.test(string);
};
