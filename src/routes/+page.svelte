<script>
  import '../app.css';
  import { onMount } from 'svelte';

  // Define blue gradients using colors from the app's stylesheet
  const featureGradients = [
    'linear-gradient(135deg, #3498db, #2980b9)', // Primary blue gradient
    'linear-gradient(135deg, #5dade2, #3498db)', // Lighter blue gradient
    'linear-gradient(135deg, #3498db, #5dade2)', // Lighter blue gradient
    'linear-gradient(20deg, #2980b9, #5499c7)', // Medium blue gradient
    'linear-gradient(205deg, #1abc9c, #48c9b0)'  // Blue-teal gradient
  ];
</script>

<main>
  <div class="home-container">
    <div class="gradient-bg"></div>
    <div class="content-wrapper">
      <div class="header-section">
        <h1>AP Test Prep</h1>
        <p class="tagline">Practice for your AP exams with our free, adaptive test platform</p>
      </div>
      
      <div class="features">
        <div class="feature-card">
          <div class="feature-icon" style="background: {featureGradients[0]}">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open-text-icon lucide-book-open-text"><path d="M12 7v14"/><path d="M16 12h2"/><path d="M16 8h2"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/><path d="M6 12h2"/><path d="M6 8h2"/></svg>
          </div>
          <h3>Multiple Subjects</h3>
          <p>Practice tests for all major AP subjects</p>
        </div>
        
        <div class="feature-card">
          <div class="feature-icon" style="background: {featureGradients[1]}">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock-fading-icon lucide-clock-fading"><path d="M12 2a10 10 0 0 1 7.38 16.75"/><path d="M12 6v6l4 2"/><path d="M2.5 8.875a10 10 0 0 0-.5 3"/><path d="M2.83 16a10 10 0 0 0 2.43 3.4"/><path d="M4.636 5.235a10 10 0 0 1 .891-.857"/><path d="M8.644 21.42a10 10 0 0 0 7.631-.38"/></svg>
          </div>
          <h3>Time Tracking</h3>
          <p>Test yourself under realistic time conditions</p>
        </div>
        
        <div class="feature-card">
          <div class="feature-icon" style="background: {featureGradients[2]}">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-check-icon lucide-check-check"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>
          </div>
          <h3>Performance Analysis</h3>
          <p>Track your progress and identify areas to improve</p>
        </div>
      </div>
      
      <div class="cta-section">
        <a href="/tests" class="primary-button">Start Practicing</a>
      </div>
    </div>
  </div>
</main>

<style>
  /* Main container for landing page */
  .home-container {
    width: 100%;
    min-height: 100vh;
    background-color: var(--white);
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    overflow: hidden;
  }
  
  /* Gradient background element */
  .gradient-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(53, 152, 219, 0.1) 0%, rgba(53, 152, 219, 0.05) 100%);
    z-index: 0;
  }
  
  .gradient-bg::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -50%;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle, rgba(53, 152, 219, 0.1) 0%, rgba(255, 255, 255, 0) 70%);
    border-radius: 50%;
  }
  
  .gradient-bg::after {
    content: '';
    position: absolute;
    bottom: -30%;
    left: -30%;
    width: 80%;
    height: 80%;
    background: radial-gradient(circle, rgba(52, 152, 219, 0.1) 0%, rgba(255, 255, 255, 0) 70%);
    border-radius: 50%;
  }
  
  /* Content width consistent with test UI */
  .content-wrapper {
    width: 75%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 0;
    position: relative;
    z-index: 1;
  }
  
  /* Header styling */
  .header-section {
    text-align: center;
    margin-bottom: 4rem;
  }
  
  h1 {
    font-size: 3.5rem;
    font-weight: 700;
    color: var(--text-dark);
    margin-bottom: 1.2rem;
    background: linear-gradient(to right, var(--text-dark), var(--primary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .tagline {
    font-size: 1.6rem;
    color: var(--text-light);
    max-width: 800px;
    margin: 0 auto;
  }
  
  /* Features section */
  .features {
    display: flex;
    gap: 2.5rem;
    justify-content: center;
    margin-bottom: 4rem;
    flex-wrap: wrap;
  }
  
  .feature-card {
    background-color: var(--white);
    border-radius: 12px;
    padding: 2.5rem;
    box-shadow: var(--shadow-md);
    flex: 1;
    min-width: 260px;
    max-width: 350px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    transition: all 0.4s ease;
    border: 1px solid rgba(53, 152, 219, 0.1);
    background: linear-gradient(to bottom, var(--white), rgba(255, 255, 255, 0.95));
  }
  
  .feature-card:hover {
    transform: translateY(-15px);
    box-shadow: var(--shadow-lg);
    border-color: rgba(53, 152, 219, 0.3);
  }
  
  .feature-icon {
    color: var(--white);
    width: 80px;
    height: 80px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.8rem;
    box-shadow: 0 5px 15px rgba(53, 152, 219, 0.3);
  }
  
  .feature-card h3 {
    font-size: 1.6rem;
    font-weight: 600;
    color: var(--text-dark);
    margin-bottom: 1.2rem;
  }
  
  .feature-card p {
    color: var(--text-light);
    line-height: 1.6;
    font-size: 1.1rem;
  }
  
  /* CTA section */
  .cta-section {
    text-align: center;
    margin-top: 2.5rem;
  }
  
  .primary-button {
    display: inline-block;
    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
    color: var(--white);
    font-size: 1.3rem;
    font-weight: 600;
    padding: 1.2rem 3rem;
    border-radius: 50px;
    text-decoration: none;
    transition: all 0.3s ease;
    box-shadow: 0 5px 15px rgba(53, 152, 219, 0.4);
  }
  
  .primary-button:hover {
    transform: translateY(-5px) scale(1.03);
    box-shadow: 0 10px 20px rgba(53, 152, 219, 0.5);
  }
  
  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .content-wrapper {
      width: 90%;
      padding: 2rem 0;
    }
    
    h1 {
      font-size: 2.8rem;
    }
    
    .tagline {
      font-size: 1.3rem;
    }
    
    .features {
      flex-direction: column;
      align-items: center;
    }
    
    .feature-card {
      width: 100%;
      max-width: 100%;
    }
  }
</style>
