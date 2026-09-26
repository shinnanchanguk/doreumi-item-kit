// Server text is printed to the terminal (and read by the AI): strip control and direction-changing characters.
export const clean = (value, max) => (typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, " ").slice(0, max) : "");
