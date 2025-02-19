export const logger = {
  error: (message, data) => {
    console.error(message, data);
  },
  info: (message, data) => {
    console.log(message, data);
  },
  trace: (message, data) => {
    console.log(message, data);
  },
  debug: (message, data) => {
    console.debug(message, data);
  }
};
