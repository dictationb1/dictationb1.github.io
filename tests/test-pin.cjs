// Tests must receive the lecturer UI PIN from the environment, never fixtures.
const value = process.env.LECTURER_PIN;
if (!value || !/^[0-9]{4,8}$/.test(value)) throw Error('Set LECTURER_PIN to run lecturer tests');
module.exports = value;
