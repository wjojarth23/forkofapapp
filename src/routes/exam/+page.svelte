<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  
  onMount(() => {
    // Redirect to tests page
    goto('/tests');
  });
</script>

<div class="redirect-container">
  <p>Redirecting to test selection...</p>
</div>

<style>
  .redirect-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #4a5568;
  }
</style> 