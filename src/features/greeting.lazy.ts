// Example heavy/optional feature shipped as a separate ESM chunk.
// In a real widget this is where you'd pull in a date lib, emoji picker, etc.
export default function buildGreeting(name: string): string {
  return `Hello, ${name}!`;
}
