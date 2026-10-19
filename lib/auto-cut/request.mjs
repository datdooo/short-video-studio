// Source/input mutations invalidate requests; appearance changes do not call this.
export function createAnalysisRequestGuard() {
  let serial=0,current;
  return {
    begin(){current?.controller.abort();const ticket={serial:++serial,controller:new AbortController()};current=ticket;return ticket;},
    invalidate(){serial++;current?.controller.abort();current=undefined;},
    isCurrent(ticket){return ticket===current&&ticket.serial===serial&&!ticket.controller.signal.aborted;},
    finish(ticket){if(current===ticket)current=undefined;},
  };
}
