<script>
  import { onMount, onDestroy } from 'svelte';
  
  // Variables to track time
  let seconds = 0;
  let minutes = 0;
  let hours = 0;
  
  // Interval ID
  /** @type {number | null} */
  let timerInterval = null;
  
  // Timer state
  let isRunning = false;
  
  // Public properties
  export let autoStart = false;
  
  // Start timer
  function startTimer() {
    if (!isRunning) {
      timerInterval = setInterval(updateTimer, 1000);
      isRunning = true;
    }
  }
  
  // Stop timer
  function stopTimer() {
    if (isRunning && timerInterval !== null) {
      clearInterval(timerInterval);
      isRunning = false;
    }
  }
  
  // Reset timer
  function resetTimer() {
    stopTimer();
    seconds = 0;
    minutes = 0;
    hours = 0;
  }
  
  // Update timer every second
  function updateTimer() {
    seconds++;
    if (seconds >= 60) {
      seconds = 0;
      minutes++;
      if (minutes >= 60) {
        minutes = 0;
        hours++;
      }
    }
  }
  
  // Format time for display
  function formatTime(/** @type {number} */ value) {
    return value.toString().padStart(2, '0');
  }
  
  // Get total time in seconds (for external components)
  export function getTotalSeconds() {
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  // Cleanup interval when component is destroyed
  onDestroy(() => {
    if (timerInterval !== null) {
      clearInterval(timerInterval);
    }
  });
  
  // Auto-start if requested
  onMount(() => {
    if (autoStart) {
      startTimer();
    }
  });
</script>

<div class="stopwatch">
  <div class="time-display">
    <span class="time-unit">{formatTime(hours)}</span>
    <span class="separator">:</span>
    <span class="time-unit">{formatTime(minutes)}</span>
    <span class="separator">:</span>
    <span class="time-unit">{formatTime(seconds)}</span>
  </div>
  
  <div class="controls">
    {#if isRunning}
      <button class="btn-stop" on:click={stopTimer}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <rect x="6" y="5" width="4" height="14" />
          <rect x="14" y="5" width="4" height="14" />
        </svg>
        <span>Pause</span>
      </button>
    {:else}
      <button class="btn-start" on:click={startTimer}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <polygon points="5,3 19,12 5,21" />
        </svg>
        <span>Start</span>
      </button>
    {/if}
    <button class="btn-reset" on:click={resetTimer}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M17.65 6.35A8 8 0 1 0 19 12h-2a6 6 0 1 1-1.01-3.35L14 10h5V5l-1.35 1.35z"/>
      </svg>
      <span>Reset</span>
    </button>
  </div>
</div>

<style>
  .stopwatch {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: 'Roboto', Arial, sans-serif;
  }
  
  .time-display {
    font-size: 2rem;
    font-weight: 500;
    color: #2c3e50;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }
  
  .time-unit {
    display: inline-block;
    min-width: 2.2ch;
    text-align: center;
  }
  
  .separator {
    animation: blink 1s infinite;
    animation-timing-function: step-end;
    opacity: 0.7;
  }
  
  @keyframes blink {
    50% {
      opacity: 0.3;
    }
  }
  
  .controls {
    display: flex;
    gap: 8px;
  }
  
  button {
    min-width: 80px;
    height: 32px;
    border: none;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
    padding: 0 12px;
    font-size: 0.85rem;
    font-weight: 500;
  }
  
  button svg {
    margin-right: 5px;
  }
  
  button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
  
  button:active {
    transform: translateY(0);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }
  
  .btn-start {
    background-color: #3498db;
    color: white;
  }
  
  .btn-start:hover {
    background-color: #2980b9;
  }
  
  .btn-stop {
    background-color: #e74c3c;
    color: white;
  }
  
  .btn-stop:hover {
    background-color: #c0392b;
  }
  
  .btn-reset {
    background-color: #7f8c8d;
    color: white;
  }
  
  .btn-reset:hover {
    background-color: #636e72;
  }
</style> 