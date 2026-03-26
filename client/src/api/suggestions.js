export async function fetchSuggestions(formData) {
  const res = await fetch('/api/suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return { cards: data.cards, advisorNarrative: data.advisorNarrative ?? null, treasuryRates: data.treasuryRates ?? null };
}
