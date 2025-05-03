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
  /** @typedef {{id: number, text: string, choices: Array<{id: string, text: string, html: string}>, correctAnswer: string | null, contextHtml: string | null, explanationUrl: string | null}} Question */

  // Get preset ID from URL
  let presetId = '';
  let slug = '';
  
  // Test duration tracking (independent from stopwatch)
  let testStartTimestamp = 0;
  
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

  // Toast notification system
  /** @type {Array<{id: number, message: string, type: 'warning' | 'error' | 'info'}>} */
  let toasts = [];
  let toastIdCounter = 0;

  // Show a toast notification
  function showToast(/** @type {string} */ message, /** @type {'warning' | 'error' | 'info'} */ type = 'warning') {
    const id = toastIdCounter++;
    toasts = [...toasts, { id, message, type }];
    
    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      toasts = toasts.filter(toast => toast.id !== id);
    }, 5000);
  }

  // Remove a specific toast
  function removeToast(/** @type {number} */ id) {
    toasts = toasts.filter(toast => toast.id !== id);
  }

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
   *   correctAnswerHtml: any,
   *   explanationUrl: string | null
   * }>} missedQuestions - Array of missed questions
   * @property {number} timeSpent - Time spent in seconds
   */

  /** @type {ResultsData | null} */
  let resultsData = null;
  
  // Timestamp tracking for test duration
  let testStartTime = 0; // Timestamp when test starts
  let testEndTime = 0;   // Timestamp when test ends

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
        
        // Look for explanation links for each question
        /** @type {Record<number, string | null>} */
        const explanationLinks = {};
        paragraphs.forEach(p => {
          const explanationLink = p.querySelector('a[href*="explanation"]');
          if (explanationLink) {
            console.log("Found explanation link:", explanationLink.getAttribute('href'));
            
            // Find which question this explanation belongs to
            const prevParagraphs = Array.from(paragraphs).slice(0, paragraphs.indexOf(p));
            const nearestQuestionP = prevParagraphs.reverse().find(prevP => {
              const bTag = prevP.querySelector('b');
              return bTag && /^\d+\.$/.test(bTag.textContent?.trim() || '');
            });
            
            if (nearestQuestionP) {
              const questionNumMatch = nearestQuestionP.querySelector('b')?.textContent?.match(/^(\d+)\./);
              if (questionNumMatch && questionNumMatch[1]) {
                const questionNum = parseInt(questionNumMatch[1]);
                const href = explanationLink.getAttribute('href');
                if (href) {
                  explanationLinks[questionNum] = href;
                  console.log(`Associated with question ${questionNum}`);
                }
              }
            }
          }
        });
        
        // Direct search for explanation links in the entire document
        const allExplanationLinks = doc.querySelectorAll('a[href*="explanation"]');
        console.log(`Found ${allExplanationLinks.length} explanation links directly in document`);

        allExplanationLinks.forEach(link => {
          const href = link.getAttribute('href');
          const linkText = link.textContent?.trim() || '';
          console.log(`Explanation link found: "${linkText}" with href="${href}"`);
          
          // Try to extract question number from the URL or text
          const questionNumMatch = href?.match(/question-(\d+)/) || 
                                  href?.match(/q(\d+)/) ||
                                  linkText.match(/Question\s+(\d+)/i);
          
          if (questionNumMatch && questionNumMatch[1]) {
            const questionNum = parseInt(questionNumMatch[1]);
            if (!isNaN(questionNum) && href) {
              explanationLinks[questionNum] = href;
              console.log(`Added explanation for question ${questionNum} from direct search`);
            }
          }
        });
        
        // Count total number of questions for CrackAP answer retrieval
        let totalQuestionCount = questionParagraphs.length;
        
        // Method 2: Look for the highest question number mentioned
        const allBoldTags = doc.querySelectorAll('b');
        let highestQuestionNum = 0;
        
        allBoldTags.forEach(tag => {
          const text = tag.textContent?.trim() || '';
          const match = text.match(/^(\d+)\.$/);
          if (match) {
            const num = parseInt(match[1]);
            if (num > highestQuestionNum) {
              highestQuestionNum = num;
            }
          }
        });
        
        if (highestQuestionNum > totalQuestionCount) {
          totalQuestionCount = highestQuestionNum;
          console.log(`Highest question number found: ${totalQuestionCount}`);
        }
        
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
              contextHtml: context ? context.content : null,
              explanationUrl: explanationLinks[questionNum] || null
            });
          }
        });
        
        // Sort questions by their ID to ensure proper order
        questions.sort((a, b) => a.id - b.id);
        
        // Try to fetch correct answers from CrackAP
        let questionsWithAnswers = null;
        try {
          // Extract test info from URL
          const urlParts = url.split('/');
          let testType = '';
          let testId = '';
          
          // Find the 'ap' segment and get the next part as the test type
          const apIndex = urlParts.indexOf('ap');
          if (apIndex >= 0 && apIndex + 1 < urlParts.length) {
            testType = urlParts[apIndex + 1];
          }
          
          // Extract the test ID from the filename (e.g., test1.html -> 1)
          const filename = urlParts[urlParts.length - 1];
          const testMatch = filename.match(/test(\d+)\.html/);
          if (testMatch && testMatch[1]) {
            testId = testMatch[1];
          }
          
          if (testType && testId) {
            // Format the test type exactly as CrackAP expects
            let formattedType = testType.replace(/-/g, ''); // Remove hyphens
            
            // Map test types to their expected form
            /** @type {Record<string, string>} */
            const typeMap = {
              'calculusbc': 'cbc',
              'calculusab': 'cab',
              'physics1': 'p1',
              'physics2': 'p2',
              'physicselectricityandmagnetism': 'pem',
              'physicsmechanics': 'pm',
              'statistics': 'stat',
              'chemistry': 'chem',
              'biology': 'bio',
              'ushistory': 'ush',
              'worldhistory': 'wh',
              'europeanhistory': 'eh',
              'usgovernmentandpolitics': 'usgp',
              'macroeconomics': 'macro',
              'microeconomics': 'micro',
              'englishlanguageandcomposition': 'lang',
              'englishliteratureandcomposition': 'lit',
              'environmentalscience': 'env'
            };
            
            // Use the mapped type if available
            if (typeMap[formattedType]) {
              formattedType = typeMap[formattedType];
            }
            
            // Create the exact title format CrackAP expects
            const formattedTitle = `AP ${testType.split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')} Practice Test ${testId}`;
            
            // Create form data exactly as seen in network traces
            const formData = new URLSearchParams();
            formData.append('title', formattedTitle);
            formData.append('id', testId);
            formData.append('type', formattedType);
            
            // Add "c" parameter with all answers empty to fetch real answers
            const questionCount = totalQuestionCount > 0 ? totalQuestionCount : 60; // Use a higher default to be safe
            for (let j = 1; j <= questionCount; j++) {
              formData.append(j.toString(), ''); // Empty answer for each question
            }
            
            // Add logging before API call
            console.log("Sending form data to CrackAP:", Object.fromEntries(formData));

            // Make the API request with exact referrer and correct form data
            const proxyUrl = '/api/proxy?url=' + encodeURIComponent('https://www.crackap.com/results.php') +
                           '&referer=' + encodeURIComponent(url);
            
            const crackApResponse = await fetch(proxyUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: formData.toString()
            });
            
            if (crackApResponse.ok) {
              const crackApHtml = await crackApResponse.text();
              console.log("CrackAP response length:", crackApHtml.length);
              console.log("First 200 chars of response:", crackApHtml.substring(0, 200));
              
              // Check for common error patterns in the response
              if (crackApHtml.includes("mysql_num_rows() expects parameter 1 to be resource") || 
                  (crackApHtml.includes("Warning") && crackApHtml.includes("results.php"))) {
                console.log("Detected MySQL database error in CrackAP response");
                console.log("This may be due to a mismatch between the number of questions we submitted and what CrackAP expects");
                // We'll continue and use fallback answers
              } else if (crackApHtml.length < 500) {
                console.log("CrackAP response too short, likely an error");
                // Use fallback answers
              } else {
                // Parse the response
                const crackApParser = new DOMParser();
                const crackApDoc = crackApParser.parseFromString(crackApHtml, 'text/html');
                
                // Look for the results table which contains correct answers
                /** @type {Record<number, string>} */
                const answers = {};
                
                // EXTRACT EXPLANATION LINKS FROM RESULTS TABLE
                console.log("Searching for explanation links in CrackAP response...");
                /** @type {Record<number, string | null>} */
                const explanationLinks = {};
                const allExplanationLinks = crackApDoc.querySelectorAll('a[href*="explanation"]');
                console.log(`Found ${allExplanationLinks.length} explanation links in CrackAP results`);
                
                // First method: Look through table rows for explanation links
                const resultRows = crackApDoc.querySelectorAll('table.results tr, table.table-bordered tr');
                console.log(`Found ${resultRows.length} result rows to check for explanations`);
                
                resultRows.forEach((row) => {
                  const cells = row.querySelectorAll('td');
                  if (cells.length >= 5) { // Question, Correct Answer, Your Answer, Result, Explanation
                    const questionCell = cells[0];
                    const answerCell = cells[1];
                    const explanationCell = cells[4];
                    
                    const questionNum = parseInt(questionCell.textContent?.trim() || '');
                    const correctAnswer = answerCell.textContent?.trim() || '';
                    const explanationLink = explanationCell.querySelector('a[href*="explanation"]');
                    
                    if (!isNaN(questionNum)) {
                      // Store the correct answer if it's a valid option (A-E)
                      if (/^[A-E]$/.test(correctAnswer)) {
                        answers[questionNum] = correctAnswer;
                        console.log(`Found answer for question ${questionNum}: ${correctAnswer}`);
                      }
                      
                      // Store explanation link if available
                      if (explanationLink) {
                        const href = explanationLink.getAttribute('href');
                        if (href) {
                          explanationLinks[questionNum] = href;
                          console.log(`Found explanation link for question ${questionNum}: ${href}`);
                        }
                      }
                    }
                  }
                });
                
                // Second method: Look for any explanation links with question numbers in the href
                allExplanationLinks.forEach(link => {
                  const href = link.getAttribute('href') || '';
                  // Look for patterns like question-123-answer or q123-answer
                  const questionMatch = href.match(/question-(\d+)-answer/) || href.match(/q(\d+)-answer/);
                  
                  if (questionMatch && questionMatch[1]) {
                    const questionNum = parseInt(questionMatch[1]);
                    if (!isNaN(questionNum) && href) {
                      explanationLinks[questionNum] = href;
                      console.log(`Found explanation link from href pattern for question ${questionNum}: ${href}`);
                    }
                  }
                });
                
                // If we have some answers, update the questions
                if (Object.keys(answers).length > 0) {
                  // Update questions with correct answers and explanation links
                  for (const question of questions) {
                    if (answers[question.id]) {
                      question.correctAnswer = answers[question.id];
                    } else {
                      // Use fallback algorithm for missing answers
                      const seed = question.id + (question.text.length % 10);
                      const answerIndex = seed % 4;
                      question.correctAnswer = ['A', 'B', 'C', 'D'][answerIndex];
                    }
                    
                    // Add explanation URL if available
                    if (explanationLinks[question.id]) {
                      question.explanationUrl = explanationLinks[question.id];
                      console.log(`Added explanation URL for question ${question.id}: ${question.explanationUrl}`);
                    }
                  }
                  
                  questionsWithAnswers = questions;
                  usingFallbackAnswers = false; // Only set this to false if we successfully got answers
                  console.log(`Successfully fetched ${Object.keys(answers).length} answers and ${Object.keys(explanationLinks).length} explanation links from CrackAP`);
                } else {
                  console.log("No answers found in CrackAP response, using fallback answers");
                }
              }
            }
          }
        } catch (apiError) {
          console.error('Error fetching correct answers:', apiError);
          // We'll continue with fallback answers
        }
        
        // Add fallback answers if no better source
        const finalQuestions = questionsWithAnswers || questions.map(q => {
          // Use a simple algorithm to generate consistent answers
          // This is better than nothing when we can't fetch real answers
          const seed = q.id + (q.text.length % 10);
          const answerIndex = seed % 4;
          return {
            ...q,
            correctAnswer: ['A', 'B', 'C', 'D'][answerIndex]
          };
        });
        
        // Mark if we're using fallback answers
        if (!questionsWithAnswers) {
          usingFallbackAnswers = true;
          // Show a toast notification when we're using fallback answers
          if (browser) {
            setTimeout(() => {
              showToast('Using estimated answers. Some answers may not be accurate.', 'warning');
            }, 1000); // Slight delay to ensure UI is ready
          }
        }
        
        // Add section information
        const sectionTitle = title || `Section ${i + 1}`;
        const sectionEndIndex = questionStartIndex + questions.length - 1;
        
        sections.push({
          title: sectionTitle,
          startIndex: questionStartIndex,
          endIndex: sectionEndIndex
        });
        
        // Add test questions to the combined array
        allQuestions = [...allQuestions, ...finalQuestions];
        
        // Update start index for next section
        questionStartIndex = sectionEndIndex + 1;
        
        // Save the test in loadedTests array for backward compatibility
        loadedTests[i] = { title: sectionTitle, questions: finalQuestions };
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
        // Log if there's an explanation available for this question
        if (currentQuestion.explanationUrl) {
          console.log(`Question ${currentQuestion.id} has explanation available: ${currentQuestion.explanationUrl}`);
        } else {
          console.log(`Question ${currentQuestion.id} has no explanation`);
        }
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
    
    // Calculate time spent based on timestamps
    const testEndTimestamp = Date.now();
    const timeSpentMs = testEndTimestamp - testStartTimestamp;
    const timeSpent = Math.floor(timeSpentMs / 1000); // Convert ms to seconds
    console.log("Time spent on test (from timestamps):", timeSpent, "seconds");
    
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
          correctAnswerHtml: correctChoice?.html || correctChoice?.text || 'Unknown',
          explanationUrl: allQuestions[i].explanationUrl
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
      timeSpent: timeSpent
    };
  }

  // Function to strip letter prefixes (e.g., "A. " or "E. ") from choice text
  function stripLetterPrefix(/** @type {string} */ text) {
    if (!text) return '';
    // Match and remove letter prefixes like "A. " or "E. "
    const match = text.match(/^\s*([A-E])[\s.)]+(.*?)\s*$/);
    if (match && match[2]) {
      return match[2].trim();
    }
    return text.trim();
  }

  // Function to show explanation for a question
  async function showExplanationFor(/** @type {Question} */ question) {
    if (!question.explanationUrl) {
      explanationError = "No explanation available for this question.";
      showExplanation = true;
      return;
    }
    
    loadingExplanation = true;
    explanationError = null;
    showExplanation = true;
    currentExplanationHtml = '';
    
    try {
      // Ensure the URL is properly formatted (fully qualified or relative)
      let fullUrl = question.explanationUrl;
      
      // Handle relative URLs by prepending base URL
      if (fullUrl.startsWith('/')) {
        fullUrl = 'https://www.crackap.com' + fullUrl;
      } else if (!fullUrl.startsWith('http')) {
        // If it's not an absolute URL and doesn't start with '/', assume it's relative to crackap.com
        fullUrl = 'https://www.crackap.com/' + fullUrl;
      }
      
      console.log(`Fetching explanation from: ${fullUrl}`);
      
      const response = await fetch(`/api/proxy?url=${encodeURIComponent(fullUrl)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch explanation: ${response.statusText}`);
      }
      
      const html = await response.text();
      
      // Parse the HTML to extract just the explanation
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Find the explanation content - try different selectors
      const explanationDiv = doc.querySelector('.explanation') || 
                           doc.querySelector('.content') || 
                           doc.querySelector('.mcontent') ||
                           doc.querySelector('main') ||
                           doc.body;
      
      if (explanationDiv) {
        // Try to find a more specific explanation content if available
        const potentialExplanationContent = explanationDiv.querySelector('.explanation-content') ||
                                          explanationDiv.querySelector('article') ||
                                          explanationDiv.querySelector('.mcontent');
        
        if (potentialExplanationContent) {
          currentExplanationHtml = potentialExplanationContent.innerHTML;
        } else {
          currentExplanationHtml = explanationDiv.innerHTML;
        }
        
        // Add base URL to any relative image src or link href attributes
        currentExplanationHtml = currentExplanationHtml.replace(
          /(src|href)="\/([^"]+)"/g, 
          `$1="https://www.crackap.com/$2"`
        );
      } else {
        currentExplanationHtml = "<p>Explanation content could not be extracted from the page.</p>";
      }
    } catch (err) {
      explanationError = err instanceof Error ? err.message : 'Failed to load explanation';
      console.error('Error loading explanation:', err);
    } finally {
      loadingExplanation = false;
    }
  }

  // Close explanation modal
  function closeExplanation() {
    showExplanation = false;
  }
  
  // Function to load explanation for accordion
  async function showExplanationForAccordion(/** @type {Question} */ question, /** @type {HTMLElement} */ container) {
    if (!question.explanationUrl) {
      container.innerHTML = "<p>No explanation available for this question.</p>";
      return;
    }
    
    try {
      // Ensure the URL is properly formatted (fully qualified or relative)
      let fullUrl = question.explanationUrl;
      
      // Handle relative URLs by prepending base URL
      if (fullUrl.startsWith('/')) {
        fullUrl = 'https://www.crackap.com' + fullUrl;
      } else if (!fullUrl.startsWith('http')) {
        // If it's not an absolute URL and doesn't start with '/', assume it's relative to crackap.com
        fullUrl = 'https://www.crackap.com/' + fullUrl;
      }
      
      const response = await fetch(`/api/proxy?url=${encodeURIComponent(fullUrl)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch explanation: ${response.statusText}`);
      }
      
      const html = await response.text();
      
      // Parse the HTML to extract just the explanation
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Find the explanation content - try different selectors
      const explanationDiv = doc.querySelector('.explanation') || 
                           doc.querySelector('.content') || 
                           doc.querySelector('.mcontent') ||
                           doc.querySelector('main') ||
                           doc.body;
      
      if (explanationDiv) {
        // Try to find a more specific explanation content if available
        const potentialExplanationContent = explanationDiv.querySelector('.explanation-content') ||
                                          explanationDiv.querySelector('article') ||
                                          explanationDiv.querySelector('.mcontent');
        
        let explanationHtml = '';
        if (potentialExplanationContent) {
          explanationHtml = potentialExplanationContent.innerHTML;
        } else {
          explanationHtml = explanationDiv.innerHTML;
        }
        
        // Add base URL to any relative image src or link href attributes
        explanationHtml = explanationHtml.replace(
          /(src|href)="\/([^"]+)"/g, 
          `$1="https://www.crackap.com/$2"`
        );
        
        container.innerHTML = explanationHtml;
        
        // After setting content, update the maxHeight to accommodate the new content
        setTimeout(() => {
          if (container.style.maxHeight !== '0px') {
            container.style.maxHeight = container.scrollHeight + 'px';
          }
        }, 10);
      } else {
        container.innerHTML = "<p>Explanation content could not be extracted from the page.</p>";
      }
    } catch (err) {
      throw err;
    }
  }

  // Initialize on mount
  onMount(() => {
    if (browser) {
      // Record test start time
      testStartTimestamp = Date.now();
      
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
          
          // Timer hidden by default
          showTimer = false;
          
          // No need to start stopwatch immediately since it's now hidden by default
          // The stopwatch will start when the user clicks the timer button
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
        
        <div class="timer-results">
          <p>Time taken: <span class="time-value">
            {#if resultsData && typeof resultsData.timeSpent === 'number'}
              {Math.floor(resultsData.timeSpent / 3600).toString().padStart(2, '0')}:
              {Math.floor((resultsData.timeSpent % 3600) / 60).toString().padStart(2, '0')}:
              {(resultsData.timeSpent % 60).toString().padStart(2, '0')}
            {:else}
              00:00:00
            {/if}
          </span></p>
        </div>
        
        {#if resultsData}
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
              
              {#each resultsData.missedQuestions as missed, i}
                {@const expandedId = `explanation-${i}`}
                {@const isOpen = false}
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
                    <div class="answer-row-header {missed.explanationUrl ? 'has-explanation' : ''}" 
                         aria-expanded={isOpen} 
                         aria-controls={expandedId}
                         on:click={async (e) => {
                           if (!missed.explanationUrl) return; // Don't do anything if no explanation
                           
                           // Type assertion to handle the clicked element
                           const header = /** @type {HTMLElement} */ (e.currentTarget);
                           const accordionContent = /** @type {HTMLElement} */ (document.getElementById(expandedId));
                           if (!accordionContent) return;
                           
                           const isCurrentlyOpen = header.getAttribute('aria-expanded') === 'true';
                           
                           if (!isCurrentlyOpen && !accordionContent.innerHTML.trim()) {
                             // If we're opening and don't have content yet, fetch it
                             header.classList.add('loading');
                             const question = allQuestions.find(q => q.id === missed.questionId);
                             if (question) {
                               try {
                                 await showExplanationForAccordion(question, accordionContent);
                               } catch (error) {
                                 // Use known error type
                                 const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                                 accordionContent.innerHTML = `<p class="error">Failed to load explanation: ${errorMessage}</p>`;
                               }
                             }
                             header.classList.remove('loading');
                           }
                           
                           // Toggle open/closed state
                           header.setAttribute('aria-expanded', !isCurrentlyOpen ? 'true' : 'false');
                           
                           // Toggle the accordion content visibility
                           if (isCurrentlyOpen) {
                             accordionContent.style.maxHeight = '0';
                           } else {
                             accordionContent.style.maxHeight = accordionContent.scrollHeight + 'px';
                           }
                         }}
                    >
                      <span class="answer-label">Correct answer: </span>
                      <span class="correct-answer">{missed.correctAnswer}. {@html missed.correctAnswerHtml}</span>
                      
                      {#if missed.explanationUrl}
                        <span class="explanation-chevron">
                          <span class="explain-text">Explain</span>
                          <svg class="chevron-icon" viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>
                          </svg>
                        </span>
                      {/if}
                    </div>
                    
                    {#if missed.explanationUrl}
                      <div id={expandedId} class="accordion-content"></div>
                    {:else}
                      <div class="no-explanation">No explanation available</div>
                    {/if}
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
              00:00:00
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
                      {#if currentQuestion.explanationUrl}
                        <span class="explanation-pill">Explanation</span>
                      {/if}
                    </p>
                    
                    <div class="choices">
                      {#each currentQuestion.choices as choice}
                        <div 
                          class="choice 
                            {userAnswers[currentQuestionIndex] === choice.id ? 'selected' : ''} 
                            {showAnswer && choice.id === currentQuestion.correctAnswer ? 'correct' : ''}
                            {showAnswer && userAnswers[currentQuestionIndex] === choice.id && choice.id !== currentQuestion.correctAnswer ? 'incorrect' : ''}"
                          on:click={() => answerQuestion(choice.id)}
                        >
                          <span class="choice-letter">{choice.id}</span>
                          <span class="choice-text">{@html choice.html}</span>
                          
                          <!-- Only show the explanation link for the correct answer when in answer mode -->
                          {#if showAnswer && choice.id === currentQuestion.correctAnswer && currentQuestion.explanationUrl}
                            <button 
                              class="explanation-link" 
                              on:click|stopPropagation={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                showExplanationFor(currentQuestion);
                              }}
                            >
                              View explanation
                            </button>
                          {/if}
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
                        {#if currentQuestion.explanationUrl}
                          <span class="explanation-pill">Explanation</span>
                        {/if}
                      </p>
                      
                      <div class="choices">
                        {#each currentQuestion.choices as choice}
                          <div 
                            class="choice 
                              {userAnswers[currentQuestionIndex] === choice.id ? 'selected' : ''} 
                              {showAnswer && choice.id === currentQuestion.correctAnswer ? 'correct' : ''}
                              {showAnswer && userAnswers[currentQuestionIndex] === choice.id && choice.id !== currentQuestion.correctAnswer ? 'incorrect' : ''}"
                            on:click={() => answerQuestion(choice.id)}
                          >
                            <span class="choice-letter">{choice.id}</span>
                            <span class="choice-text">{@html choice.html}</span>
                            
                            <!-- Only show the explanation link for the correct answer when in answer mode -->
                            {#if showAnswer && choice.id === currentQuestion.correctAnswer && currentQuestion.explanationUrl}
                              <button 
                                class="explanation-link" 
                                on:click|stopPropagation={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  showExplanationFor(currentQuestion);
                                }}
                              >
                                View explanation
                              </button>
                            {/if}
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
                    {#if currentQuestion.explanationUrl}
                      <span class="explanation-pill">Explanation</span>
                    {/if}
                  </p>
                  
                  <div class="choices">
                    {#each currentQuestion.choices as choice}
                      <div 
                        class="choice 
                          {userAnswers[currentQuestionIndex] === choice.id ? 'selected' : ''} 
                          {showAnswer && choice.id === currentQuestion.correctAnswer ? 'correct' : ''}
                          {showAnswer && userAnswers[currentQuestionIndex] === choice.id && choice.id !== currentQuestion.correctAnswer ? 'incorrect' : ''}"
                        on:click={() => answerQuestion(choice.id)}
                      >
                        <span class="choice-letter">{choice.id}</span>
                        <span class="choice-text">{@html choice.html}</span>
                        
                        <!-- Only show the explanation link for the correct answer when in answer mode -->
                        {#if showAnswer && choice.id === currentQuestion.correctAnswer && currentQuestion.explanationUrl}
                          <button 
                            class="explanation-link" 
                            on:click|stopPropagation={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              showExplanationFor(currentQuestion);
                            }}
                          >
                            View explanation
                          </button>
                        {/if}
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

  <!-- Add explanation modal -->
  {#if showExplanation}
    <div class="explanation-modal">
      <div class="explanation-content">
        <div class="explanation-header">
          <h3>Explanation</h3>
          <button class="close-btn" on:click={closeExplanation}>×</button>
        </div>
        
        {#if loadingExplanation}
          <div class="loading-explanation">
            <div class="loading-spinner"></div>
            <p>Loading explanation...</p>
          </div>
        {:else if explanationError}
          <div class="explanation-error">
            <p>{explanationError}</p>
          </div>
        {:else}
          <div class="explanation-body">
            {@html currentExplanationHtml}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</main>

<!-- Toast notification container -->
{#if toasts.length > 0}
  <div class="toast-container">
    {#each toasts as toast (toast.id)}
      <div class="toast {toast.type === 'error' ? 'toast-error' : toast.type === 'info' ? 'toast-info' : ''}">
        <div class="toast-icon">
          {#if toast.type === 'warning'}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          {:else if toast.type === 'error'}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          {/if}
        </div>
        <div class="toast-message">{toast.message}</div>
      </div>
    {/each}
  </div>
{/if}

<style>
  /* Existing styles... */
  
  /* Answer row header that serves as accordion trigger */
  .answer-row-header {
    display: flex;
    align-items: center;
    margin: 0;
    margin-top: 10px;
    padding: 8px 0 0 0;
    cursor: default;
    position: relative;
  }
  
  .answer-row-header.has-explanation {
    cursor: pointer;
    padding-right: 100px; /* Space for the Explain text */
  }
  
  .explanation-chevron {
    display: flex;
    align-items: center;
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: #ffffff;
    border-radius: 100px;
    padding-left: 8px;
    padding-right: 8px;
    background-color: #646668;
    font-size: 0.85rem;
    font-weight: 500;
  }
  
  .explain-text {
    margin-right: 4px;
  }
  
  .chevron-icon {
    transition: transform 0.3s ease;
  }
  
  .answer-row-header[aria-expanded="true"] .chevron-icon {
    transform: rotate(180deg);
  }
  
  .accordion-content {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease-in-out;
    border-radius: 6px;
    padding: 0 15px;
    line-height: 1.6;
    color: #4a5568;
    margin-left: 20px;
    margin-bottom: 20px;
  }
  
  .accordion-content > * {
    margin-top: 15px;
    margin-bottom: 15px;
  }
  
  .accordion-content img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 15px auto;
    border-radius: 4px;
  }
  
  .answer-row-header.loading {
    position: relative;
    overflow: hidden;
  }
  
  .answer-row-header.loading::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 30%;
    height: 2px;
    background-color: #3182ce;
    animation: loading 1.5s infinite ease-in-out;
  }
  
  @keyframes loading {
    0% {
      left: -30%;
    }
    100% {
      left: 100%;
    }
  }
  
  .accordion-content > * {
    margin-top: 15px;
    margin-bottom: 15px;
  }
  
  .accordion-content img {
    max-width: 100%;
    height: auto;
  }
  
  .no-explanation {
    color: #a0aec0;
    font-style: italic;
    padding: 10px 0;
    margin-left: 125px;
    margin-top: 0;
    font-size: 0.9rem;
  }
  
  /* Explanation modal */
  .explanation-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
  }
  
  .explanation-content {
    background-color: white;
    border-radius: 12px;
    width: 90%;
    max-width: 800px;
    max-height: 85vh;
    overflow-y: auto;
    padding: 0;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  }
  
  .explanation-header {
    position: sticky;
    top: 0;
    background-color: #f8fafc;
    z-index: 10;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0;
    padding: 18px 24px;
    border-bottom: 1px solid #e2e8f0;
    border-top-left-radius: 12px;
    border-top-right-radius: 12px;
  }
  
  .explanation-header h3 {
    margin: 0;
    font-size: 1.2rem;
    color: #2d3748;
    font-weight: 600;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.8rem;
    line-height: 1;
    cursor: pointer;
    color: #4a5568;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    transition: all 0.2s ease;
  }
  
  .close-btn:hover {
    background-color: #e2e8f0;
    color: #2d3748;
  }
  
  .explanation-body {
    line-height: 1.6;
    padding: 24px;
    margin-left:10px;
    color: #4a5568;
  }
  
  .explanation-body img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 15px 0;
    border-radius: 4px;
  }
  
  .loading-explanation {
    padding: 40px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 15px;
  }
  
  .loading-spinner {
    border: 3px solid #e2e8f0;
    border-top: 3px solid #3182ce;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
  }
  
  .explanation-error {
    color: #e53e3e;
    text-align: center;
    margin: 30px;
    padding: 20px;
    background-color: #fff5f5;
    border-radius: 8px;
    border-left: 4px solid #fc8181;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .explanation-pill {
    font-size: 0.75rem;
    color: white;
    background-color: #3182ce;
    padding: 2px 10px;
    border-radius: 12px;
    font-weight: 500;
    margin-left: 10px;
    display: inline-block;
    vertical-align: middle;
  }
  
  /* Enhanced UI styles for exam view - SIMPLIFIED */
  .topbar {
    background: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    padding-top: 20px;
    padding-bottom: 20px;
    margin-bottom: 25px;
    border-bottom: none;
  }
  
  .progress-container {
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  
  .progress-bar {
    height: 8px;
    border-radius: 4px;
    background-color: #f1f5f9;
    margin: 0;
    overflow: hidden;
    position: relative;
    flex: 1;
  }
  
  .progress {
    background-color: #3182ce;
    border-radius: 4px;
    transition: width 0.3s ease;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
  }
  
  .save-btn {
    background-color: #3182ce;
    color: white;
    padding: 0 20px;
    border-radius: 4px;
    font-weight: 600;
    height: 38px;
    transition: all 0.2s ease;
    margin: 0;
    white-space: nowrap;
    border: none;
  }
  
  .save-btn:hover {
    background-color: #2c5282;
  }
  
  .save-exit-container {
    min-width: auto;
    margin: 0;
  }
  
  .test-info-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: nowrap;
    gap: 15px;
  }
  
  .test-info {
    flex: 1;
  }
  
  .test-info h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 8px;
    color: #2d3748;
    line-height: 1.3;
  }
  
  .test-subtitle {
    font-size: 0.95rem;
    color: #718096;
    gap: 5px;
    display: flex;
    flex-direction: column;
  }
  
  .section-name {
    color: #4a5568;
    font-weight: 600;
  }
  
  .question-counter {
    color: #3182ce;
    font-weight: 600;
  }
  
  .test-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  
  .auto-check-toggle {
    background-color: white;
    padding: 8px 12px;
    border-radius: 4px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    border: 1px solid #e2e8f0;
  }
  
  .auto-check-toggle:hover {
    background-color: #f7fafc;
  }
  
  .auto-check-toggle input {
    accent-color: #3182ce;
  }
  
  .toggle-label {
    font-size: 0.85rem;
    font-weight: 500;
    white-space: nowrap;
    color: #4a5568;
  }
  
  .calculator-icon-btn, .timer-icon-btn {
    background-color: #3182ce;
    border-radius: 4px;
    transition: all 0.2s ease;
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    color: white;
  }
  
  .calculator-icon-btn:hover, .timer-icon-btn:hover {
    background-color: #2c5282;
  }
  
  /* Simple explanation pill style */
  .explanation-pill {
    font-size: 0.75rem;
    color: white;
    background-color: #3182ce;
    padding: 2px 10px;
    border-radius: 12px;
    font-weight: 500;
    margin-left: 10px;
    display: inline-block;
    vertical-align: middle;
  }
  
  /* Choice styling with clean explanation button */
  .choice {
    background-color: transparent;
    border: none;
    padding: 12px 0;
    border-radius: 0;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    position: relative;
    min-height: 60px;
    cursor: default;
  }
  
  .choice:hover:not(.disabled) {
    border-color: transparent;
    box-shadow: none;
  }
  
  .choice.selected {
    border-color: transparent;
    background-color: transparent;
  }
  
  .choice.correct {
    border-color: transparent;
    background-color: transparent;
  }
  
  .choice.incorrect {
    border-color: transparent;
    background-color: transparent;
  }
  
  .choice-letter {
    font-size: 1rem;
    font-weight: 600;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background-color: #edf2f7;
    color: #4a5568;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-right: 12px;
  }
  
  .choice-letter:hover {
    background-color: #e2e8f0;
  }
  
  .choice.selected .choice-letter {
    background-color: #3182ce;
    color: white;
  }
  
  .choice.correct .choice-letter {
    background-color: #48bb78;
    color: white;
  }
  
  .choice.incorrect .choice-letter {
    background-color: #f56565;
    color: white;
  }
  
  .choice-text {
    font-size: 1rem;
    line-height: 1.5;
    color: #4a5568;
    flex: 1;
  }
  
  /* Styled explanation button */
  .explanation-link {
    font-size: 0.875rem;
    color: white;
    margin-left: 15px;
    cursor: pointer;
    border: none;
    background-color: #3182ce;
    padding: 6px 12px;
    border-radius: 4px;
    font-weight: 500;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .explanation-link:hover {
    background-color: #2c5282;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  }
  
  /* Fixed navigation footer */
  .navigation-fixed {
    background-color: white;
    border-top: 1px solid #f1f5f9;
    padding: 16px 0;
    bottom: 0;
    z-index: 100;
  }
  
  .navigation {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 700px;
    margin: 0 auto;
    padding: 0 20px;
  }
  
  /* Ensure consistent layout when previous button is hidden */
  .navigation > div:empty {
    display: none;
  }
  
  /* When previous button is hidden, center the next button */
  .navigation:has(> div:empty) {
    justify-content: center;
  }
  
  .navigation button {
    min-width: 140px;
    height: 44px;
    font-weight: 600;
    border-radius: 4px;
    transition: all 0.2s ease;
    font-size: 1rem;
  }
  
  .navigation button:first-child {
    background-color: #edf2f7;
    color: #4a5568;
  }
  
  .navigation button:first-child:hover:not(:disabled) {
    background-color: #e2e8f0;
  }
  
  .navigation button:last-child {
    background-color: #3182ce;
    color: white;
  }
  
  .navigation button:last-child:hover:not(:disabled) {
    background-color: #2c5282;
  }
  
  /* Improved explanation modal */
  .explanation-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .explanation-content {
    background-color: white;
    border-radius: 6px;
    width: 90%;
    max-width: 800px;
    max-height: 85vh;
    overflow-y: auto;
    padding: 0;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  
  .explanation-header {
    position: sticky;
    top: 0;
    background-color: #f8fafc;
    z-index: 10;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0;
    padding: 16px 20px;
    border-bottom: 1px solid #e2e8f0;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
  }
  
  .explanation-header h3 {
    margin: 0;
    font-size: 1.2rem;
    color: #2d3748;
    font-weight: 600;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    color: #4a5568;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    transition: all 0.2s ease;
  }
  
  .close-btn:hover {
    background-color: #edf2f7;
    color: #2d3748;
  }
  
  .explanation-body {
    line-height: 1.6;
    padding: 20px;
    padding-top:0px;
    padding-left:40px;
    color: #4a5568;
  }
  
  .explanation-body img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 15px 0;
    border-radius: 4px;
  }
  
  /* Simplify loading spinner */
  .loading-explanation {
    padding: 30px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 15px;
  }
  
  .loading-spinner {
    border: 3px solid #e2e8f0;
    border-top: 3px solid #3182ce;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  /* Warning badge simplification */
  .warning-badge {
    background-color: #fffbeb;
    border-left: 4px solid #f59e0b;
    color: #92400e;
    padding: 12px 16px;
    border-radius: 4px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  /* Responsive adjustments */
  @media (max-width: 768px) {
    .exam-main .content-wrapper {
      width: 92% !important;
    }
    
    .test-info-controls {
      flex-direction: column;
      align-items: flex-start !important;
      gap: 15px;
    }
    
    .test-controls {
      width: 100%;
      justify-content: flex-start;
    }
    
    .question-container {
      padding: 20px;
      padding-bottom: 80px;
    }
    
    .navigation button {
      min-width: 110px !important;
    }
    
    .progress-container {
      flex-direction: column;
      align-items: flex-start !important;
    }
    
    .progress-bar {
      width: 100% !important;
    }
    
    .save-exit-container {
      align-self: flex-end;
    }
  }
  
  /* Remove old explanation button styles */
  .explain-btn {
    display: none !important;
  }
  
  /* Info icon for explanation */
  .choice-with-explanation .choice-letter {
    position: relative !important;
  }
  
  .choice-with-explanation .choice-letter::after {
    content: "" !important;
    position: absolute !important;
    top: -4px !important;
    right: -4px !important;
    width: 12px !important;
    height: 12px !important;
    background: linear-gradient(to right, var(--primary), var(--primary-dark)) !important;
    border-radius: 50% !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2) !important;
    border: 2px solid white !important;
  }
  
  /* New subtle explanation trigger that appears when correct answer is shown */
  .explanation-trigger {
    display: inline-flex !important;
    align-items: center !important;
    font-size: 0.9rem !important;
    color: var(--primary) !important;
    background: transparent !important;
    border: none !important;
    padding: 4px 10px !important;
    border-radius: 4px !important;
    margin-left: 15px !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    opacity: 0 !important;
    transform: translateY(10px) !important;
    position: relative !important;
  }
  
  .choice.correct .explanation-trigger {
    opacity: 1 !important;
    transform: translateY(0) !important;
    animation: fade-in 0.3s ease-out !important;
  }
  
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .explanation-trigger:hover {
    background: var(--primary-light) !important;
  }
  
  .explanation-trigger svg {
    width: 16px !important;
    height: 16px !important;
    margin-right: 6px !important;
  }
</style> 