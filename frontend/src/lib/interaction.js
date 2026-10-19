export function matches(text, query) {
  return !query || text.toLowerCase().includes(query.trim().toLowerCase());
}

export function sessionSearchText(session) {
  return `${session.learner} ${session.title} ${session.result} ${session.recording}`;
}

export function openOnKey(action) {
  return (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
    }
  };
}

