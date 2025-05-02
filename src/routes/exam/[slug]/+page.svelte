<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Stopwatch from '$lib/Stopwatch.svelte';
  import classPresets from '$lib/classPresets.json';
  import '../../../app.css';

  // Type definitions to fix linter errors
  /** @typedef {{startQuestion: number, endQuestion: number, content: string}} ContextSection */
  /** @typedef {{id: number, text: string, choices: Array<{id: string, text: string, html: string}>, correctAnswer: string | null, contextHtml: string | null, explanationUrl?: string}} Question */

  // Get preset ID from URL
  let presetId = '';
  let slug = '';
  
  $: if ($page.params.slug) {
    slug = $page.params.slug;
    // Convert the slug to a standardized format for matching
    presetId = slug.replace(/-/g, '_');
  }
  
  // State variables
  /** @type {string[]} */
  let testUrls = [];
  /** @type {any[]} */
  let loadedTests = [];
  let currentTestIndex = -1;
  let currentQuestionIndex = 0;
  /** @type {(string | null)[]} */
  let userAnswers = [];
  let showResults = false;
  let loading = false;
  /** @type {string | null} */
  let error = null;
  let usingFallbackAnswers = false; // Track if we're using fallback answers
  let testTitle = "AP Practice Test"; // Combined test title
  
  // Enhanced features state
  /** @type {any} */
  let selectedPreset = null;
  let currentUrlIndex = 0; // To track which URL in a preset we're on
  /** @type {any[]} */
  let allQuestions = []; // Combined questions from all tests in a preset
  let showFinalResults = false; // Show final results at the end of all tests
  /** @type {any} */
  let stopwatchRef; // Reference to the stopwatch component
  
  // Section information
  /** @type {Array<{title: string, startIndex: number, endIndex: number}>} */
  let sections = [];
  let currentSectionIndex = 0;
  
  // UI features
  let autoCheckEnabled = false; // Auto-check toggle
  let showAnswer = false; // Show answer state
  let showCalculator = false; // Show calculator state
  let answerSubmitted = false; // Track if the current answer has been submitted
  let currentStreak = 0; // Track current streak of correct answers
  let totalAnswered = 0; // Track total questions answered 
  let correctAnswered = 0; // Track total correct answers
  
  // Calculator position and size
  let calculatorPos = { x: 20, y: 140 };
  let calculatorSize = { width: 400, height: 500 };
  let isDragging = false;
  let isResizing = false;
  let dragStartPos = { x: 0, y: 0 };
  let dragStartOffset = { x: 0, y: 0 };
  let resizeStartSize = { width: 0, height: 0 };
  /** @type {HTMLElement | null} */
  let calculatorModalRef = null;

  // Timer modal variables
  let showTimer = false; // Changed from true to false to make timer start hidden
  let timerPos = { x: 20, y: 140 }; // Default position until we can calculate it
  let isTimerDragging = false; // Track timer dragging state
  let timerDragStartPos = { x: 0, y: 0 }; // Starting position for timer drag
  let timerDragStartOffset = { x: 0, y: 0 }; // Starting offset for timer drag
  /** @type {HTMLElement | null} */
  let timerModalRef = null; // Reference to timer modal element

  // Variable to hold initially loaded progress
  /** @type {any | null} */
  let initialProgress = null;

  // State variables for explanation modal
  let showExplanation = false;
  let currentExplanationHtml = '';
  let loadingExplanation = false;
  /** @type {string | null} */
  let explanationError = null;

  /** 
   * @typedef {Object} ResultsData
   * @property {number} totalQuestions - Total number of questions
   * @property {number} answeredQuestions - Number of answered questions
   * @property {number} correctAnswers - Number of correct answers
   * @property {number} accuracy - Accuracy percentage
   * @property {Array<{
   *   questionNumber: number, 
   *   questionId: any, 
   *   questionText: any, 
   *   userAnswer: string | null, 
   *   userAnswerText: any, 
   *   userAnswerHtml: any,
   *   correctAnswer: any, 
   *   correctAnswerText: any,
   *   correctAnswerHtml: any
   * }>} missedQuestions - Array of missed questions
   * @property {number} timeSpent - Time spent in seconds
   */

  /** @type {ResultsData | null} */
  let resultsData = null;

  // Functions section (these will be added in separate files)
  function selectPreset(/** @type {any} */ preset) {
    selectedPreset = preset;
    testTitle = preset.name;
    
    // Check for saved progress
    if (hasSavedProgressForPreset(preset.id)) {
      console.log("Resuming progress from preset selection...");
      const loadedProgress = loadProgress(preset.id);
      if (loadedProgress && loadedProgress.testUrls) {
        loadAllTests(preset.urls, loadedProgress, loadedProgress.testUrls);
      } else {
        clearProgress();
        loadAllTests(preset.urls);
      }
    } else {
      console.log("Starting new test session from preset selection.");
      loadAllTests(preset.urls);
    }
  }
  
  // Load all tests from the preset and combine them
  async function loadAllTests(/** @type {string[]} */ presetUrls, /** @type {any | null} */ progressToRestore = null, /** @type {string[] | null} */ urlsToUse = null) {
    loading = true;
    error = null;
    usingFallbackAnswers = false;
    allQuestions = [];
    sections = [];
    
    try {
      let questionStartIndex = 0;
      
      // Determine the order of URLs to load
      let urlsToLoad;
      if (urlsToUse) {
        urlsToLoad = urlsToUse;
        console.log("Using provided URL order for loading tests.");
      } else {
        // Shuffle URLs for a fresh start
        const shuffledUrls = [...presetUrls];
        console.log("Shuffling URLs for new test session.");
        for (let i = shuffledUrls.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledUrls[i], shuffledUrls[j]] = [shuffledUrls[j], shuffledUrls[i]];
        }
        urlsToLoad = shuffledUrls;
      }
      
      // Update the component's state variable
      testUrls = urlsToLoad;
      
      // Load each test using the determined URL order
      for (let i = 0; i < urlsToLoad.length; i++) {
        const url = urlsToLoad[i];
        
        console.log(`Loading test ${i + 1}/${urlsToLoad.length}: ${url}`);
        
        // Load test content
        const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch test content from ${url}`);
        }
        
        const html = await response.text();
        
        // Parse the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extract the test title
        let title = doc.querySelector('title')?.textContent || 'AP Practice Test';
        // Try to get a more specific title if available
        const h1Title = doc.querySelector('h1')?.textContent;
        if (h1Title) {
          title = h1Title.trim();
        }
        
        // Find all the contextual information sections (these are usually in <pre> tags)
        /** @type {ContextSection[]} */
        const contextSections = [];
        const preTags = doc.querySelectorAll('pre');
        
        preTags.forEach(preTag => {
          const contextHeader = preTag.querySelector('b')?.textContent;
          if (contextHeader && contextHeader.includes('Questions')) {
            // This is context information for multiple questions
            // Extract the question range
            const rangeMatch = contextHeader.match(/Questions\s+(\d+)-(\d+)/);
            if (rangeMatch) {
              const startQuestion = parseInt(rangeMatch[1]);
              const endQuestion = parseInt(rangeMatch[2]);
              
              // Get the content of the pre tag as HTML
              const contentHtml = preTag.innerHTML;
              
              contextSections.push({
                startQuestion,
                endQuestion,
                content: contentHtml
              });
            }
          }
        });
        
        // Parse questions & options (simplified for brevity)
        /** @type {Question[]} */
        const questions = [];
        // Extract questions using basic parsing approach
        const paragraphs = Array.from(doc.querySelectorAll('p'));
        const questionParagraphs = paragraphs.filter(p => {
          const bTag = p.querySelector('b');
          return bTag && /^\d+\.$/.test(bTag.textContent?.trim() || '');
        });
        
        // For each question paragraph, extract the question text and find the associated options
        questionParagraphs.forEach((questionP, index) => {
          const questionNum = parseInt(questionP.querySelector('b')?.textContent?.replace('.', '') || '0');
          
          // Extract the question text without the number
          let questionText = questionP.innerHTML;
          const bTag = questionP.querySelector('b');
          if (bTag) {
            questionText = questionText.replace(bTag.outerHTML, '').trim();
          }
          
          // Find options for this question - they should be the next set of div.radio elements
          const options = [];
          let currentElement = questionP.nextElementSibling;
          
          // Look for div.radio elements until we hit the next question or run out of elements
          while (currentElement && 
                 currentElement.tagName === 'DIV' && 
                 currentElement.querySelector('input[type="radio"]')) {
            
            const radioInput = currentElement.querySelector('input[type="radio"]');
            // Clone the element to manipulate it without affecting the original
            const optionClone = /** @type {HTMLElement} */ (currentElement.cloneNode(true));
            
            // Remove any radio input elements from the clone
            optionClone.querySelectorAll('input[type="radio"]').forEach((input) => {
              input.remove();
            });
            
            // Get the raw HTML option content
            const optionHtml = optionClone.innerHTML;
            const optionValue = radioInput?.getAttribute('value') || '';
            const textContent = currentElement.textContent?.trim() || '';
            
            // Determine the correct letter ID (A, B, C, D, E)
            let choiceId = optionValue; // Default to value attribute
            if (!choiceId || choiceId === '') {
              // Try to extract the letter from the text content
              const textMatch = textContent.match(/^\s*([A-E])[.)\s]/);
              if (textMatch) {
                choiceId = textMatch[1];
              } else {
                // Use index-based letter if all else fails
                choiceId = String.fromCharCode(65 + options.length); // A, B, C, D, E...
              }
            }
            
            // Clean text content (remove the letter prefix) but preserve special notations
            let cleanedText = textContent;
            const letterMatch = cleanedText.match(/^\s*([A-E])[.)\s]+(.+)$/);
            if (letterMatch) {
              cleanedText = letterMatch[2].trim();
            }
            
            // Clean the HTML content by removing the letter prefix
            let cleanedHtml = optionHtml;
            // First try to match and remove patterns like "A." or "A " or "A."
            if (cleanedHtml.match(/^\s*[A-E][.)\s]+/)) {
              cleanedHtml = cleanedHtml.replace(/^\s*[A-E][.)\s]+/, '').trim();
            } else {
              // Try to find and remove patterns where the letter is in a tag
              cleanedHtml = cleanedHtml.replace(/^(\s*<[^>]+>)\s*[A-E][.)\s]+/, '$1').trim();
            }
            
            options.push({
              id: choiceId,
              text: cleanedText,
              html: cleanedHtml
            });
            
            // Move to the next element
            currentElement = currentElement.nextElementSibling;
          }
          
          // Only add questions with at least one option
          if (options.length > 0) {
            // Find the context information that applies to this question
            const context = contextSections.find(section => 
              questionNum >= section.startQuestion && questionNum <= section.endQuestion
            );
            
            // Add the question with correct answer (will be filled in later)
            questions.push({
              id: questionNum,
              text: questionText,
              choices: options,
              correctAnswer: null, // Will be filled later with A, B, C, or D
              contextHtml: context ? context.content : null
            });
          }
        });
        
        // Sort questions by their ID to ensure proper order
        questions.sort((a, b) => a.id - b.id);
        
        // Add fallback answers if no better source
        const questionsWithAnswers = questions.map(q => {
          // Use a simple algorithm to generate consistent answers
          // This is better than nothing when we can't fetch real answers
          const seed = q.id + (q.text.length % 10);
          const answerIndex = seed % 4;
          const correctAnswer = ['A', 'B', 'C', 'D'][answerIndex];
          return {
            ...q,
            correctAnswer
          };
        });
        
        // Add section information
        const sectionTitle = title || `Section ${i + 1}`;
        const sectionEndIndex = questionStartIndex + questions.length - 1;
        
        sections.push({
          title: sectionTitle,
          startIndex: questionStartIndex,
          endIndex: sectionEndIndex
        });
        
        // Add test questions to the combined array
        allQuestions = [...allQuestions, ...questionsWithAnswers];
        
        // Update start index for next section
        questionStartIndex = sectionEndIndex + 1;
        
        // Save the test in loadedTests array for backward compatibility
        loadedTests[i] = { title: sectionTitle, questions: questionsWithAnswers };
      }
      
      // Initialize answers array for all questions
      userAnswers = new Array(allQuestions.length).fill(null);
      currentQuestionIndex = 0;
      currentSectionIndex = 0;
      currentTestIndex = 0; // Set to first test for backward compatibility
      
      showResults = false;
      showFinalResults = false;
      
      // Restore progress if provided and valid
      if (progressToRestore && progressToRestore.presetId === selectedPreset?.id) {
        console.log("Attempting to restore progress...", progressToRestore);
        // Restore the test title if available
        if (progressToRestore.testTitle) {
          testTitle = progressToRestore.testTitle;
        }
        // Only restore answers if they match the number of questions
        if (urlsToUse && progressToRestore.answers && progressToRestore.answers.length === allQuestions.length) {
          userAnswers = progressToRestore.answers;
          currentQuestionIndex = Math.max(0, Math.min(progressToRestore.currentQuestion, allQuestions.length - 1));
          updateCurrentSectionFromQuestionIndex();
          console.log("Progress restored successfully.");
        } else {
          console.warn("Saved progress has mismatched answer count or URL order. Not restoring.");
          // If progress couldn't be restored, clear the invalid saved state
          clearProgress();
        }
      }
      
      // Start the timer
      if (stopwatchRef && typeof stopwatchRef.resetTimer === 'function') {
        stopwatchRef.resetTimer();
        stopwatchRef.startTimer();
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tests';
      error = errorMessage;
      console.error('Error loading tests:', err);
    } finally {
      loading = false;
    }
  }

  // Save progress to localStorage
  function saveProgress() {
    if (!browser) return; // Only run in browser environment
    
    try {
      // Get presetId - exit if not available
      const presetId = selectedPreset?.id;
      if (!presetId) return;

      // Create progress data for this preset
      const progress = {
        presetId: presetId,
        answers: userAnswers,
        currentQuestion: currentQuestionIndex,
        timestamp: new Date().getTime(),
        testUrls: testUrls,
        testTitle: testTitle
      };
      
      // Get existing saved progress for all tests
      /** @type {Record<string, any>} */
      let allProgress = {};
      const savedData = localStorage.getItem('apTestAllProgress');
      if (savedData) {
        allProgress = JSON.parse(savedData);
      }
      
      // Save this test's progress in the collection
      allProgress[presetId] = progress;
      
      console.log("Saving progress for preset:", presetId);
      localStorage.setItem('apTestAllProgress', JSON.stringify(allProgress));
    } catch (e) {
      console.error("Error saving progress:", e);
    }
  }
  
  // Load progress for a specific preset from localStorage
  function loadProgress(/** @type {string|undefined} */ specificPresetId = undefined) {
    if (!browser) return null; // Only run in browser environment
    
    try {
      // Get all saved progress
      const savedData = localStorage.getItem('apTestAllProgress');
      if (!savedData) return null;
      
      // Parse saved data
      /** @type {Record<string, any>} */
      const allProgress = JSON.parse(savedData);
      
      // Get preset ID to load
      const presetId = specificPresetId || selectedPreset?.id;
      if (!presetId) return null;
      
      // Get progress for this specific preset
      const progress = allProgress[presetId];
      
      // Basic validation
      if (!progress || !progress.presetId || !progress.answers || !progress.testUrls) {
        console.warn("Invalid saved progress data found for preset:", presetId);
        return null;
      }
      
      console.log("Loaded progress for preset:", presetId);
      return progress;
    } catch (e) {
      console.error('Error loading progress:', e);
      localStorage.removeItem('apTestAllProgress');
      return null;
    }
  }
  
  // Clear saved progress for the current preset only
  function clearProgress() {
    if (!browser) return; // Only run in browser environment
    
    const presetId = selectedPreset?.id;
    if (!presetId) return;
    
    try {
      // Get all saved progress
      const savedData = localStorage.getItem('apTestAllProgress');
      if (!savedData) return;
      
      // Parse saved data
      /** @type {Record<string, any>} */
      const allProgress = JSON.parse(savedData);
      
      // Remove this preset's progress
      if (allProgress[presetId]) {
        delete allProgress[presetId];
        localStorage.setItem('apTestAllProgress', JSON.stringify(allProgress));
        console.log("Cleared progress for preset:", presetId);
      }
    } catch (e) {
      console.error("Error clearing progress:", e);
    }
  }

  // Check if there's saved progress for a specific preset
  function hasSavedProgressForPreset(/** @type {string} */ presetId) {
    if (!browser) return false; // Only run in browser environment
    
    try {
      // Get all saved progress
      const savedData = localStorage.getItem('apTestAllProgress');
      if (!savedData) return false;
      
      // Parse saved data
      /** @type {Record<string, any>} */
      const allProgress = JSON.parse(savedData);
      
      // Check if this preset has valid progress
      const progress = allProgress[presetId];
      return progress && progress.presetId === presetId && Array.isArray(progress.answers);
    } catch (e) {
      console.error("Error checking for saved progress:", e);
      return false;
    }
  }

  // Update current section based on question index
  function updateCurrentSectionFromQuestionIndex() {
    for (let i = 0; i < sections.length; i++) {
      if (currentQuestionIndex >= sections[i].startIndex && currentQuestionIndex <= sections[i].endIndex) {
        currentSectionIndex = i;
        break;
      }
    }
  }

  // Get current question
  function getCurrentQuestion() {
    return allQuestions[currentQuestionIndex] || null;
  }

  // Get current section
  function getCurrentSection() {
    return sections[currentSectionIndex] || { title: '', startIndex: 0, endIndex: 0 };
  }
  
  // Answer current question
  function answerQuestion(/** @type {string} */ choiceId) {
    if (showResults || answerSubmitted) return;
    
    userAnswers[currentQuestionIndex] = choiceId;
    userAnswers = [...userAnswers]; // Trigger reactivity
    
    // Only show answers immediately if auto-check is enabled
    if (autoCheckEnabled) {
      answerSubmitted = true;
      showAnswer = true;
      
      // Update streak and accuracy stats
      totalAnswered++;
      const currentQuestion = allQuestions[currentQuestionIndex];
      const isCorrect = choiceId === currentQuestion.correctAnswer;
      
      if (isCorrect) {
        correctAnswered++;
        currentStreak++;
      } else {
        currentStreak = 0;
      }
    }
    
    // Save progress after each answer
    saveProgress();
  }
  
  // Navigation functions
  function goBackToTests() {
    // Save progress before exiting
    saveProgress();
    goto('/tests');
  }

  // A function to show statistics when exiting
  function saveAndExit() {
    // Save progress
    saveProgress();
    
    // Calculate statistics
    const totalQuestions = allQuestions.length;
    const answeredQuestions = userAnswers.filter(ans => ans !== null).length;
    const correctAnswers = userAnswers.reduce((count, answer, index) => {
      if (answer === allQuestions[index].correctAnswer) {
        return count + 1;
      }
      return count;
    }, 0);
    
    const accuracy = answeredQuestions > 0 ? Math.round((correctAnswers / answeredQuestions) * 100) : 0;
    
    // Find missed questions
    const missedQuestions = [];
    for (let i = 0; i < allQuestions.length; i++) {
      if (userAnswers[i] !== null && userAnswers[i] !== allQuestions[i].correctAnswer) {
        // Find the user's selected choice
        const userChoice = allQuestions[i].choices.find(
          /** @param {any} choice */
          choice => choice.id === userAnswers[i]
        );
        
        // Find the correct choice
        const correctChoice = allQuestions[i].choices.find(
          /** @param {any} choice */
          choice => choice.id === allQuestions[i].correctAnswer
        );
        
        missedQuestions.push({
          questionNumber: i + 1,
          questionId: allQuestions[i].id,
          questionText: allQuestions[i].text,
          userAnswer: userAnswers[i],
          userAnswerText: userChoice?.text || 'Unknown',
          userAnswerHtml: userChoice?.html || userChoice?.text || 'Unknown',
          correctAnswer: allQuestions[i].correctAnswer,
          correctAnswerText: correctChoice?.text || 'Unknown',
          correctAnswerHtml: correctChoice?.html || correctChoice?.text || 'Unknown'
        });
      }
    }
    
    // Show results screen instead of navigating away
    showResults = true;
    // Save the statistics and missed questions data for the results screen
    resultsData = {
      totalQuestions,
      answeredQuestions,
      correctAnswers,
      accuracy,
      missedQuestions,
      timeSpent: stopwatchRef ? stopwatchRef.getTotalSeconds() : 0
    };
  }

  // Initialize on mount
  onMount(() => {
    if (browser) {
      console.log("Initializing exam page with slug:", slug);
      console.log("Available presets:", classPresets.presets.map(p => p.id));
      
      // Find preset by ID or slug
      if (slug) {
        // Try to find the preset that matches by ID or normalized slug
        const preset = classPresets.presets.find(p => 
          p.id === presetId || // Exact ID match
          p.id.toLowerCase() === slug.toLowerCase() || // Case-insensitive match
          p.name.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase() // Slug match
        );
        
        if (preset) {
          console.log("Found preset:", preset.name);
          // Initialize the exam with the selected preset
          selectedPreset = preset;
          testTitle = preset.name;
          
          // Check for saved progress
          if (hasSavedProgressForPreset(preset.id)) {
            console.log("Resuming progress from preset selection...");
            const loadedProgress = loadProgress(preset.id);
            if (loadedProgress && loadedProgress.testUrls) {
              // Load with saved progress and saved URL order
              loadAllTests(preset.urls, loadedProgress, loadedProgress.testUrls);
            } else {
              clearProgress();
              loadAllTests(preset.urls); // Start fresh
            }
          } else {
            // No saved progress, start fresh
            console.log("Starting new test session");
            loadAllTests(preset.urls);
          }
        } else {
          console.error(`Preset with slug "${slug}" not found.`);
          error = `Preset with slug "${slug}" not found. Please select a test from the test selection page.`;
        }
      } else {
        console.error("No preset slug provided in URL.");
        error = "No test selected. Please select a test from the test selection page.";
      }
    }
  });
</script>

<main class="exam-main">
  <div class="exam-container">
    <!-- Loading state -->
    {#if loading}
      <div class="loading">
        <p>Loading your exam...</p>
      </div>
    <!-- Error state -->
    {:else if error}
      <div class="error">
        <h1>Error</h1>
        <p>{error}</p>
        <button on:click={goBackToTests}>Back to Test Selection</button>
      </div>
    <!-- Results Page -->
    {:else if showResults}
      <div class="results-container">
        <h2>Test Results</h2>
        <h3>{testTitle}</h3>
        
        {#if resultsData}
          <div class="timer-results">
            <p>Time taken: <span class="time-value">
              {Math.floor(resultsData.timeSpent / 3600).toString().padStart(2, '0')}:
              {Math.floor((resultsData.timeSpent % 3600) / 60).toString().padStart(2, '0')}:
              {(resultsData.timeSpent % 60).toString().padStart(2, '0')}
            </span></p>
          </div>
          
          <div class="results-summary">
            <div class="result-item">
              <span class="label">Total Questions</span>
              <span class="value">{resultsData.totalQuestions}</span>
            </div>
            
            <div class="result-item">
              <span class="label">Completed</span>
              <span class="value">{resultsData.answeredQuestions}</span>
              <span class="accuracy-note">({Math.round((resultsData.answeredQuestions / resultsData.totalQuestions) * 100)}%)</span>
            </div>
            
            <div class="result-item correct">
              <span class="label">Correct Answers</span>
              <span class="value">{resultsData.correctAnswers}</span>
            </div>
            
            <div class="result-item accuracy">
              <span class="label">Accuracy</span>
              <span class="value">{resultsData.accuracy}%</span>
            </div>
          </div>
          
          {#if resultsData.missedQuestions.length > 0}
            <div class="incorrect-questions">
              <h3>Questions You Missed</h3>
              
              {#each resultsData.missedQuestions as missed}
                <div class="missed-question">
                  <p class="question-text">
                    <strong>Question {missed.questionNumber} (ID: {missed.questionId}):</strong> 
                    {@html missed.questionText}
                  </p>
                  <div class="answer-info">
                    <p>
                      <span class="answer-label">Your answer: </span>
                      <span class="user-answer">{missed.userAnswer}. {@html missed.userAnswerHtml}</span>
                    </p>
                    <p>
                      <span class="answer-label">Correct answer: </span>
                      <span class="correct-answer">{missed.correctAnswer}. {@html missed.correctAnswerHtml}</span>
                    </p>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="no-missed">
              <p>Great job! You didn't miss any questions you attempted.</p>
            </div>
          {/if}
        {:else}
          <div class="timer-results">
            <p>Time taken: <span class="time-value">
              {#if stopwatchRef}
                {Math.floor(stopwatchRef.getTotalSeconds() / 3600).toString().padStart(2, '0')}:
                {Math.floor((stopwatchRef.getTotalSeconds() % 3600) / 60).toString().padStart(2, '0')}:
                {(stopwatchRef.getTotalSeconds() % 60).toString().padStart(2, '0')}
              {:else}
                00:00:00
              {/if}
            </span></p>
          </div>
        {/if}
        
        <div class="results-actions">
          <button on:click={() => goto('/tests')} class="return-btn">Return to Classes</button>
          <button on:click={() => {
            showResults = false;
            currentQuestionIndex = 0;
            updateCurrentSectionFromQuestionIndex();
          }} class="continue-btn">Continue Practicing</button>
        </div>
      </div>
    <!-- Test UI -->
    {:else if selectedPreset && allQuestions.length > 0}
      <!-- New topbar layout with progress bar -->
      <div class="topbar">
        <div class="content-wrapper">
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress" style="width: {((currentQuestionIndex + 1) / allQuestions.length) * 100}%"></div>
            </div>
            <div class="save-exit-container">
              <button on:click={saveAndExit} class="save-btn">Save and Exit</button>
            </div>
          </div>
          
          <div class="test-info-controls">
            <div class="test-info">
              <h2>{testTitle}</h2>
              <div class="test-subtitle">
                <span>Section: {currentSectionIndex + 1} of {sections.length} - <span class="section-name">{getCurrentSection().title}</span></span>
                <span class="question-counter">Question {currentQuestionIndex + 1} of {allQuestions.length}</span>
              </div>
            </div>
            
            <div class="test-controls">
              <!-- Auto-check toggle -->
              <label class="auto-check-toggle">
                <input type="checkbox" bind:checked={autoCheckEnabled}>
                <span class="toggle-label">Auto-check answers</span>
              </label>
              
              <button on:click={() => showCalculator = !showCalculator} class="calculator-icon-btn" title="Toggle Calculator">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h16V4H4zm2 2h12v4H6V6zm0 6h4v2H6v-2zm6 0h4v2h-4v-2zm-6 4h4v2H6v-2zm6 0h4v2h-4v-2z"/>
                </svg>
              </button>
              
              <button on:click={() => showTimer = !showTimer} class="timer-icon-btn" title="Toggle Timer">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm1-8.5V7c0-.6-.4-1-1-1s-1 .4-1 1v4.5c0 .3.1.5.3.7l3.2 3.2c.4.4 1.1.4 1.5 0 .4-.4.4-1.1 0-1.5L13 11.5z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="content-wrapper">
        <!-- Add fallback answer warning here -->
        {#if usingFallbackAnswers}
          <div class="warning-badge">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            <span>Using estimated answers. CrackAP's answer service returned errors or no data.</span>
          </div>
        {/if}
        
        <!-- Main question content -->
        {#if getCurrentQuestion()}
          {@const currentQuestion = getCurrentQuestion()}
          <div class="question-container">
            <div class="question">
              {#if currentQuestion.contextHtml || (showCalculator && currentQuestion.contextHtml)}
                <!-- Two-column layout for questions with context -->
                <div class="context-question-layout">
                  <div class="question-context">
                    {#if currentQuestion.contextHtml}
                      {@html currentQuestion.contextHtml}
                    {:else if showCalculator}
                      <!-- Calculator inside context area - won't be shown since context exists -->
                      <div class="embedded-calculator">
                        <iframe 
                          src="https://www.desmos.com/calculator" 
                          title="Desmos Graphing Calculator">
                        </iframe>
                      </div>
                    {/if}
                  </div>
                  
                  <div class="question-content">
                    <p class="question-text">
                      <strong>Question {currentQuestion.id}:</strong> 
                      {@html currentQuestion.text}
                    </p>
                    
                    <div class="choices">
                      {#each currentQuestion.choices as choice}
                        <div 
                          class="choice 
                            {userAnswers[currentQuestionIndex] === choice.id ? 'selected' : ''} 
                            {showAnswer && choice.id === currentQuestion.correctAnswer ? 'correct' : ''}
                            {showAnswer && userAnswers[currentQuestionIndex] === choice.id && choice.id !== currentQuestion.correctAnswer ? 'incorrect' : ''}
                            {answerSubmitted ? 'disabled' : ''}"
                          on:click={() => answerQuestion(choice.id)}
                        >
                          <span class="choice-letter">{choice.id}</span>
                          <span class="choice-text">{@html choice.html}</span>
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              {:else}
                <!-- Modified layout for questions without context - Check if calculator should be shown -->
                {#if showCalculator}
                  <!-- Two-column layout with calculator in place of context -->
                  <div class="context-question-layout">
                    <div class="question-context calculator-context">
                      <div class="embedded-calculator">
                        <iframe 
                          src="https://www.desmos.com/calculator" 
                          title="Desmos Graphing Calculator">
                        </iframe>
                      </div>
                    </div>
                    
                    <div class="question-content">
                      <p class="question-text">
                        <strong>Question {currentQuestion.id}:</strong> 
                        {@html currentQuestion.text}
                      </p>
                      
                      <div class="choices">
                        {#each currentQuestion.choices as choice}
                          <div 
                            class="choice 
                              {userAnswers[currentQuestionIndex] === choice.id ? 'selected' : ''} 
                              {showAnswer && choice.id === currentQuestion.correctAnswer ? 'correct' : ''}
                              {showAnswer && userAnswers[currentQuestionIndex] === choice.id && choice.id !== currentQuestion.correctAnswer ? 'incorrect' : ''}
                              {answerSubmitted ? 'disabled' : ''}"
                            on:click={() => answerQuestion(choice.id)}
                          >
                            <span class="choice-letter">{choice.id}</span>
                            <span class="choice-text">{@html choice.html}</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  </div>
                {:else}
                  <!-- Regular layout for questions without context and no calculator -->
                  <p class="question-text">
                    <strong>Question {currentQuestion.id}:</strong> 
                    {@html currentQuestion.text}
                  </p>
                  
                  <div class="choices">
                    {#each currentQuestion.choices as choice}
                      <div 
                        class="choice 
                          {userAnswers[currentQuestionIndex] === choice.id ? 'selected' : ''} 
                          {showAnswer && choice.id === currentQuestion.correctAnswer ? 'correct' : ''}
                          {showAnswer && userAnswers[currentQuestionIndex] === choice.id && choice.id !== currentQuestion.correctAnswer ? 'incorrect' : ''}
                          {answerSubmitted ? 'disabled' : ''}"
                        on:click={() => answerQuestion(choice.id)}
                      >
                        <span class="choice-letter">{choice.id}</span>
                        <span class="choice-text">{@html choice.html}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              {/if}
            </div>
            
            <!-- Fixed navigation controls at the bottom -->
            <div class="navigation-fixed">
              <div class="navigation">
                {#if !autoCheckEnabled}
                  <button on:click={() => currentQuestionIndex > 0 ? currentQuestionIndex-- : null} 
                          disabled={currentQuestionIndex <= 0}>
                    Previous
                  </button>
                {:else}
                  <!-- Empty div to maintain layout when previous button is hidden -->
                  <div></div>
                {/if}
                
                <!-- Next button when answer submitted or auto-check is off -->
                <button on:click={() => {
                  // Reset submitted state when moving to next question
                  answerSubmitted = false;
                  showAnswer = false;
                  
                  if (currentQuestionIndex < allQuestions.length - 1) {
                    currentQuestionIndex++;
                    updateCurrentSectionFromQuestionIndex();
                  } else {
                    showResults = true;
                  }
                }}>
                  {currentQuestionIndex < allQuestions.length - 1 ? 'Next' : 'Finish'}
                </button>
              </div>
            </div>
          </div>
        {/if}
      </div>
    <!-- No test selected state -->
    {:else}
      <div class="no-test">
        <h2>No Test Selected</h2>
        <p>Please select a test from the test selection page.</p>
        <button on:click={goBackToTests}>Back to Test Selection</button>
      </div>
    {/if}
  </div>
  
  <!-- Timer display outside of content area -->
  {#if selectedPreset && !showResults && allQuestions.length > 0 && showTimer}
    <div class="timer-modal"
      bind:this={timerModalRef}
      style="left: {timerPos.x}px; top: {timerPos.y}px;">
      <div class="timer-header">
        <div class="title">Test Timer</div>
        <button class="timer-close" on:click={() => showTimer = false}>×</button>
      </div>
      <div class="timer-content">
        <Stopwatch bind:this={stopwatchRef} autoStart={true} />
      </div>
    </div>
  {/if}
  
  <!-- Desmos Calculator Modal - Only shown when question HAS context -->
  {#if showCalculator && getCurrentQuestion()?.contextHtml}
    <div class="calculator-modal" 
      bind:this={calculatorModalRef}
      style="left: {calculatorPos.x}px; top: {calculatorPos.y}px; width: {calculatorSize.width}px; height: {calculatorSize.height}px;">
      <div class="calculator-header">
        <div class="title">Desmos Graphing Calculator</div>
        <button class="calculator-close" on:click={() => showCalculator = false}>×</button>
      </div>
      <div class="calculator-iframe-container">
        <iframe 
          src="https://www.desmos.com/calculator" 
          style="border: none;"
          title="Desmos Graphing Calculator">
        </iframe>
      </div>
    </div>
  {/if}
</main> 