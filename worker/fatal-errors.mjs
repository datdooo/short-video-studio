/** Log no raw rejection, message, stack, credentials or user paths. */
export function installFatalHandlers({ target = process, shutdown, exit = code => process.exit(code), log = line => console.error(line), timeoutMs = 5000 }) {
  let stopping = false;
  const fatal = kind => {
    if (stopping) return;
    stopping = true;
    log(`Media worker fatal ${kind}; stopping owned commands and exiting (1).`);
    const timeout = setTimeout(() => exit(1), timeoutMs);
    timeout.unref?.();
    Promise.resolve().then(shutdown).catch(() => log('Fatal shutdown checkpoint failed.')).finally(() => {
      clearTimeout(timeout);
      exit(1);
    });
  };
  const rejection = () => fatal('unhandledRejection');
  const exception = () => fatal('uncaughtException');
  target.on('unhandledRejection', rejection);
  target.on('uncaughtException', exception);
  return () => { target.removeListener('unhandledRejection', rejection); target.removeListener('uncaughtException', exception); };
}
