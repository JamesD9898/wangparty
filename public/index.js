async function getServers() {
    try {
      const response = await fetch('/api/servers');
      if (!response.ok) throw new Error('Failed to fetch servers');
      const data = await response.json();
      console.log('Servers:', data);
    } catch (error) {
      console.error('Error:', error);
    }
  }

const response = getServers();
console.log(response);