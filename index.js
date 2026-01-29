async function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;

    const btn = document.getElementById('sendBtn');
    btn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/send`, {
            method: 'POST',
            mode: 'cors', // Wichtig für iPhone
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                user: 'iPhone', 
                text: text 
            })
        });

        if (response.ok) {
            msgInput.value = "";
            await loadMessages(); // Nachrichten sofort neu laden
        } else {
            const errorData = await response.json();
            alert("Server sagt: " + errorData.error);
        }
    } catch (e) {
        alert("Senden hat nicht geklappt. Ist der Server wach?");
    } finally {
        btn.disabled = false;
    }
}
