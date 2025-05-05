<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import classPresets from '$lib/classPresets.json';
  import '../../app.css';

  // Function to check if there's saved progress for a specific preset
  function hasSavedProgressForPreset(/** @type {string} */ presetId) {
    if (!browser) return false; // Only run in browser environment
    
    try {
      // Get all saved progress
      const savedData = localStorage.getItem('apTestAllProgress');
      if (!savedData) return false;
      
      // Parse saved data
      const allProgress = JSON.parse(savedData);
      
      // Check if this preset has valid progress
      const progress = allProgress[presetId];
      return progress && progress.presetId === presetId && Array.isArray(progress.answers);
    } catch (e) {
      console.error("Error checking for saved progress:", e);
      return false;
    }
  }

  // Function to handle selecting a preset
  function selectPreset(/** @type {any} */ preset) {
    if (browser) {
      const { name } = preset;
      console.log("Selected preset:", name);
      const presetSlug = name.toLowerCase().replace(/\s+/g, '-');
      const url = `/exam/${presetSlug}`;
      console.log("Navigating to:", url);
      goto(url);
    }
  }
  
  // Function to clear test progress for a specific preset
  function clearTestProgress(/** @type {string} */ presetId, /** @type {Event} */ event) {
    // Prevent the click from triggering the parent card click
    event.stopPropagation();
    
    if (!browser) return;
    
    try {
      // Get all saved progress
      const savedData = localStorage.getItem('apTestAllProgress');
      if (!savedData) return;
      
      // Parse saved data
      let allProgress = JSON.parse(savedData);
      
      // Remove this preset's progress
      if (allProgress[presetId]) {
        delete allProgress[presetId];
        localStorage.setItem('apTestAllProgress', JSON.stringify(allProgress));
        
        // Force a re-render
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    } catch (e) {
      console.error("Error clearing progress:", e);
    }
  }
  
  // Function to generate a random blue gradient
  /** @returns {string} */
  function getRandomBlueGradient() {
    // Generate two random vibrant blue shades
    const getRandomBlueShade = () => {
      // Generate components for more vivid blues
      // Keep red very low to avoid purple tints
      const r = Math.floor(Math.random() * 40); // 0-40 (much lower red to avoid purple)
      const g = Math.floor(Math.random() * 100) + 100; // 100-200
      const b = Math.floor(Math.random() * 55) + 200; // 200-255 (high blue)
      return `rgb(${r}, ${g}, ${b})`;
    };
    
    // Generate random angle between 0 and 360 degrees
    const angle = Math.floor(Math.random() * 360);
    
    // Return the gradient style with more contrast between colors
    return `linear-gradient(${angle}deg, ${getRandomBlueShade()}, ${getRandomBlueShade()})`;
  }
  
  // Array to store generated gradients for each preset
  /** @type {string[]} */
  let presetGradients = [];
  
  // Array to store sorted presets
  /** @type {any[]} */
  let sortedPresets = [];
  
  onMount(() => {
    // Sort presets to prioritize those with saved progress
    sortedPresets = [...classPresets.presets].sort((a, b) => {
      const aHasProgress = hasSavedProgressForPreset(a.id);
      const bHasProgress = hasSavedProgressForPreset(b.id);
      
      if (aHasProgress && !bHasProgress) return -1;
      if (!aHasProgress && bHasProgress) return 1;
      return 0;
    });
    
    // Generate gradients for each preset when the component mounts
    presetGradients = sortedPresets.map(() => getRandomBlueGradient());
  });
</script>

<main>
  <div class="tests-container">
    <div class="header-decoration"></div>
    <div class="content-wrapper">
      <div class="header-section">
        <h1>AP Practice Tests</h1>
        <p class="subtitle">Select a subject below to begin practicing</p>
      </div>
      
      <div class="preset-grid">
        {#each sortedPresets as preset, i}
          <div class="preset-card" on:click={() => selectPreset(preset)}>
            <div class="preset-icon" style="background: {presetGradients[i] || getRandomBlueGradient()}">
              {@html preset.icon}
            </div>
            <div class="preset-content">
              <h3>{preset.name}</h3>
              <p class="preset-description">{preset.description}</p>
              <div class="preset-footer">
                <span class="test-count">{preset.urls.length} practice sections</span>
                <div class="badge-container">
                  {#if hasSavedProgressForPreset(preset.id)}
                    <span class="progress-badge">In Progress</span>
                    <button class="restart-button" title="Clear progress and restart" on:click={(e) => clearTestProgress(preset.id, e)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M23 4v6h-6"></path>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                      </svg>
                    </button>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
      
      <div class="back-link">
        <a href="/" class="back-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <span>Back to Home</span>
        </a>
      </div>
    </div>
  </div>
</main>

<style>
  .tests-container {
    background-color: var(--white);
    height: 100vh;
    width: 100%;
    position: relative;
    overflow-y: auto;
    overflow-x: hidden;
  }
  
  .header-decoration {
    position: absolute;
    top: -150px; /* Moved lower by adjusting top position */
    left: 0;
    width: 100%;
    height: 450px; /* Increased height */
    background: linear-gradient(135deg, var(--primary-light) 0%, rgba(53, 152, 219, 0.05) 100%);
    clip-path: ellipse(80% 60% at 50% 40%); /* Adjusted clip path */
    z-index: 0;
  }
  
  .content-wrapper {
    width: 75%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 4rem 0;
    position: relative;
    z-index: 1;
  }
  
  .header-section {
    text-align: center;
    margin-bottom: 4rem;
  }
  
  h1 {
    font-size: 3rem;
    color: var(--text-dark);
    margin-bottom: 1rem;
    font-weight: 700;
    background: linear-gradient(to right, var(--primary-dark), var(--primary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .subtitle {
    color: var(--text-light);
    font-size: 1.3rem;
    max-width: 700px;
    margin: 0 auto;
  }
  
  .preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 2.5rem;
    margin-bottom: 4rem;
  }
  
  .preset-card {
    background: var(--white);
    border-radius: 16px;
    padding: 0;
    box-shadow: var(--shadow-md);
    transition: all 0.4s ease;
    cursor: pointer;
    display: flex;
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(53, 152, 219, 0.1);
  }
  
  .preset-card:hover {
    transform: translateY(-10px);
    box-shadow: var(--shadow-lg);
    border-color: var(--primary-light);
  }
  
  .preset-icon {
    min-width: 90px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--white);
    height: 110px; /* Increased height from default */
  }
  
  .preset-icon :global(svg) {
    width: 40px;
    height: 40px;
    stroke: white;
  }
  
  .preset-content {
    padding: 1.75rem;
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  
  .preset-card h3 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: var(--text-dark);
    font-weight: 600;
  }
  
  .preset-description {
    color: var(--text-light);
    flex-grow: 1;
    margin-bottom: 1.5rem;
    line-height: 1.6;
  }
  
  .preset-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid rgba(53, 152, 219, 0.1);
    padding-top: 1rem;
    margin-top: auto;
  }
  
  .test-count {
    color: var(--text-light);
    font-size: 0.9rem;
    font-weight: 500;
  }
  
  .badge-container {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .progress-badge {
    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
    color: var(--white);
    padding: 0.4rem 0.9rem;
    border-radius: 50px;
    font-size: 0.8rem;
    font-weight: 600;
    box-shadow: 0 2px 5px rgba(52, 152, 219, 0.3);
  }
  
  .restart-button {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.9);
    border: none;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    cursor: pointer;
    color: var(--primary);
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    padding: 0;
    margin: 0;
  }
  
  .restart-button:hover {
    background: var(--primary);
    color: var(--white);
    transform: rotate(180deg);
    box-shadow: 0 2px 6px rgba(52, 152, 219, 0.4);
  }
  
  .back-link {
    text-align: center;
    margin-top: 3rem;
  }
  
  .back-button {
    display: inline-flex;
    align-items: center;
    color: var(--primary);
    text-decoration: none;
    font-weight: 600;
    font-size: 1.1rem;
    transition: all 0.3s ease;
    padding: 0.8rem 1.5rem;
    border-radius: 50px;
    background-color: rgba(53, 152, 219, 0.1);
  }
  
  .back-button svg {
    margin-right: 8px;
  }
  
  .back-button:hover {
    background-color: var(--primary);
    color: var(--white);
    transform: translateY(-3px);
    box-shadow: 0 5px 15px rgba(53, 152, 219, 0.3);
  }
  
  @media (max-width: 768px) {
    .content-wrapper {
      width: 90%;
      padding: 2rem 0;
    }
    
    .preset-grid {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }
    
    h1 {
      font-size: 2.2rem;
    }
    
    .subtitle {
      font-size: 1.1rem;
    }
  }
</style> 