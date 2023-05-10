/* eslint-disable */
import React from 'react';
import { validCategories, dailyCategories } from './categories'

import { useState, useEffect } from 'react';

import ReactGA from 'react-ga';
const TRACKING_ID = "G-CQDJX3QBKG";
ReactGA.initialize(TRACKING_ID);

const MAX_SECONDS = 90;
const BACKEND_URL = window.location.origin;
const HINT_EVERY_N_SECONDS = 20;


function Modal({ enabled, category, onClose, onCancel, startWithCategory}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    setIsOpen(enabled);
  }, [enabled]);

  const handleOverlayClick = () => {
    onClose(category);
  };

  const handleChange = (event) => {
    setInputValue(event.target.value);
  };

  const handleKeyDown = event => {
    if (event.key === "Enter") {
      handleEnter();
    }
  } 
  
  const handleEnter = () => {
    const newCategory = inputValue ? inputValue : category;
    startWithCategory(newCategory)
  }

  return (
    <div className={`modal ${isOpen ? 'block' : 'hidden'}`}>
      <div
        className="modal-overlay bg-gray-900 bg-opacity-50 fixed inset-0 z-50"
        onClick={handleOverlayClick}
      ></div>
      <div className="modal-content bg-cyan-600 bg-w rounded-lg shadow-lg px-4 pt-5 pb-4 mb-4 text-left w-full md:max-w-md mx-auto absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
        <h2 className="modal-title text-lg font-medium text-center mb-4">Enter any category you can think of!</h2>
        
        <div className="w-full grid grid-cols-10">
        <input
          className="col-span-8 focus:outline-none focus:ring-0 border-transparent bg-amber-400 p-4 rounded-l-3xl mx-1 w-full text-center text-amber-600 font-extrabold"
          type="text"
          placeholder="Be creative!"
          onKeyDown={handleKeyDown} 
          onChange={handleChange}
          value={inputValue}
          />
        <button className="col-span-2" 
                onClick={handleEnter}>
          <div className="bg-amber-600 p-4 rounded-r-3xl mx-1 text-amber-600 text-center">
                Enter
          </div>
        </button>
        <div className="col-span-10 text-center w-full mt-2">
          <a href="#" onClick={() => {onClose(category)}} className="text-zinc-400 underline font-extrabold text-md">
            random category</a>
        </div>
        <div className="col-span-10 text-center w-full mt-2">
          <a href="#" onClick={() => {startWithCategory("coffee orders")}} className="text-zinc-500 underline font-extrabold text-md">
            coffee orders</a>
        </div>
        <div className="col-span-10 text-center w-full mt-2">
          <a href="#" onClick={() => {startWithCategory("phobias")}} className="text-zinc-500 underline font-extrabold text-md">
            phobias</a>
        </div>
        <div className="col-span-10 text-center w-full mt-2">
          <a href="#" onClick={() => {startWithCategory("mythical creatures")}} className="text-zinc-500 underline font-extrabold text-md">
            mythical creatures</a>
        </div>
        </div>




        <button
          className="modal-close rounded-full p-1 hover:bg-red-500 absolute top-0 right-0"
          onClick={onCancel}
        >
          X
        </button>
      </div>
    </div>
  );
}

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.inputRef = React.createRef();
    this.alreadyMounted = false; // In dev, React mounts components twice.

    // Get number of days since beginning
    const diff = (new Date() - new Date(2023, 2, 6));
    this.day = Math.floor(diff / (1000 * 60 * 60 * 24));

    // Make sure validcategories is all lower case
    for (const category in validCategories) {
      validCategories[category] = validCategories[category].map(item => item.toLowerCase().trim());
    }

    this.secondsSinceSubmitted = 100;
  }

  state = {
    screen: "instructions",
    percentile: -1,
    submissions: [],
    submissionInfos: [],
    submissionTextSize: "text-4xl",
    category: "",
    secondsRemaining: MAX_SECONDS, 
    score: 0,
    modalEnabled: false,
    witty_comment: "Good luck.",
    percentageTime: 100,
    ai_recently_responded: false,
    explanation: "",
    numLoading: 0,
    loadingHint: false,
  }

  componentDidMount= () => {
    if (!this.alreadyMounted) {
      this.alreadyMounted = true;
    }
    document.title = "Categorcle";
    ReactGA.event({category: "Page load", action: "Page load", label: "Page load"});
  }

  didAlreadyPersistDailyGameResults = () => {
    const key = `day_${this.day}_results`;
    return window.localStorage.getItem(key) !== null;
  }

  isDailyGame = () => {
    return this.state.category === dailyCategories[this.day]
  }

  persistDailyGameResults = (score, percentile) => {
    if (this.isDailyGame()) {
      const key = `day_${this.day}_results`;
      window.localStorage.setItem(key, JSON.stringify({score, percentile}));
    }
  }

  loadDailyGameResults = () => {
    const key = `day_${this.day}_results`;
    const results = JSON.parse(window.localStorage.getItem(key));
    return results;
  }

  postAndGetPercentile = () => {
    const validSubmissions = this.state.submissionInfos.filter(submissionInfo => submissionInfo.isValid).map(submissionInfo => submissionInfo.submission);
    const invalidSubmissions = this.state.submissionInfos.filter(submissionInfo => !submissionInfo.isValid).map(submissionInfo => submissionInfo.submission);

    ReactGA.event({category: "Game complete", action: "game complete", label: "game complete"});


    fetch(`${BACKEND_URL}/category_items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            {
              validItems: validSubmissions,
              invalidItems: invalidSubmissions, 
              category: this.state.category,
              score: this.state.score,
            }
            ),
    })
    .then(response => response.json())
    .then(data => {
      console.log(data);
      this.setState({ percentile: data.percentile });

      this.persistDailyGameResults(this.state.score, data.percentile);
    })
    .catch(error => {
      console.log(error);
    });
  }

  postSubmission = (submission, prior_submissions) => {
    this.setState(prevState => ({numLoading: prevState.numLoading + 1}));

    // Post submission with category and user submitted item
    return fetch(`${BACKEND_URL}/submit_item`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            {
              category: this.state.category,
              submission: submission,
              prior_submissions: prior_submissions,
            }),
    })
    .then(response => response.json())
    .then(data => {
      this.secondsSinceSubmitted = 0;
      console.log(data);
      // Return a promise with the result of the "valid" field
      //return data.valid && !data.tooSimilar;
      return data;
    })
    .catch(error => {
      console.error(error);
      this.setState(prevState => ({numLoading: prevState.numLoading - 1}));
    });
  }

  randomKey = object => {
    const keys = Object.keys(object);
    const randomIndex = Math.floor(Math.random() * keys.length);
    const randomKey = keys[randomIndex];
    return randomKey;
  }

  startWithCategory = (category) => {
    this.setState({ category, modalEnabled: false, numLoading: 0}, this.start);
  }

  startWithRandomCategory = () => {
    const category = this.randomKey(validCategories);
    this.setState({ category, numLoading: 0 }, this.start);
  }

  startWithDailyCategory = () => {
    const category = dailyCategories[this.day];
    this.setState({ category, numLoading: 0 }, this.start);
  }

  loadStorageIfPresent = () => {
    if (!this.isDailyGame()) {
      return;
    }

    const todayStorage = window.localStorage.getItem("day" + this.day);
    if (todayStorage) {
      const todayStorageData = JSON.parse(todayStorage);
      this.setState({
        submissions: todayStorageData.submissions,
        submissionInfos: todayStorageData.submissionInfos,
        score: todayStorageData.score,
        secondsRemaining: todayStorageData.secondsRemaining,
        percentageTime: todayStorageData.secondsRemaining / MAX_SECONDS * 100,
        submissionTextSize: todayStorageData.submissionTextSize,
        submissionGridCols: todayStorageData.submissionGridCols,
      }, this.onTimerEnd);
    }
  }

  persistTodayGameState = () => {
    if (this.state.category !== dailyCategories[this.day]) {
      return;
    }

    const todayState = {
      submissions: this.state.submissions,
      submissionInfos: this.state.submissionInfos,
      score: this.state.score,
      secondsRemaining: this.state.secondsRemaining,
      submissionTextSize: this.state.submissionTextSize,
      submissionGridCols: this.state.submissionGridCols,
    }
    window.localStorage.setItem("day" + this.day, JSON.stringify(todayState));
  }


  start = () => {
    this.loadStorageIfPresent();

    // 2. Hide the start button, and show the text input, the submission list
    this.setState({ screen: "game", "explanation": "" });
    
    // 3. Start the timer, decrementing the time every 1s
    this.timer = setInterval(() => {
      // If 10 seconds has passed since they last submitted, request a hint
      this.secondsSinceSubmitted += 1;
      if (this.secondsSinceSubmitted >= HINT_EVERY_N_SECONDS) {
        this.secondsSinceSubmitted = 0;
        this.requestHint(false);
      }

      this.onTimerEnd();
      this.setState(prevState => ({ 
        secondsRemaining: prevState.numLoading <= 0 ? prevState.secondsRemaining > 0 ? prevState.secondsRemaining - 1 : 0: prevState.secondsRemaining, 
        percentageTime: prevState.numLoading <= 0 ? (prevState.secondsRemaining - 1) / MAX_SECONDS * 100 : prevState.percentageTime,
      }));
    }, 1000);
  }

  onTimerEnd = () => {
    if (this.state.secondsRemaining <= 1) {
      clearInterval(this.timer);
      this.persistTodayGameState();

      // If it's the daily game, we could be sending this more than once
      if (this.isDailyGame() && this.didAlreadyPersistDailyGameResults()) {
        const {score, percentile} = this.loadDailyGameResults();
        this.setState({score, percentile});
      } else {
        this.postAndGetPercentile();
      }
      this.setState({ screen: "score" });
    }
  }

  end = () => {
    this.persistTodayGameState();

    clearInterval(this.timer);
    this.postAndGetPercentile();
    this.setState({ screen: "score" });
  }

  handleKeyDown = event => {
    if (event.key === "Enter") {
      this.handleSubmit();
    }
  } 

  insertSubmission = submission => {
    // Add 1 to score if the submission is in the category, and not already submitted
    // Not optimized; these should be sets
    //const isValid = validCategories[this.state.category].includes(submission);

    // Register a loading submission
    const loadingSubmission = {
      submission,
      inclusion: null,
      isValid: null,
      tooSimilar: null,
      loading: true,
    }

    // Update the text size based on the number of submissions
    var submissionTextSize = "text-4xl";
    var submissionGridCols = "grid-cols-1";
    const submissionCount = this.state.submissions.length + 1;
    if (submissionCount > 16) {
      submissionTextSize = "text-xs";
      submissionGridCols = "grid-cols-3";
    } else if (submissionCount > 7) {
      submissionTextSize = "text-base";
      submissionGridCols = "grid-cols-2";
    } else if (submissionCount > 5) {
      submissionTextSize = "text-xl";
    }

    this.setState(prevState => ({ 
      submissions: [submission, ...prevState.submissions],
      submissionInfos: [loadingSubmission, ...prevState.submissionInfos],
      submissionTextSize,
      submissionGridCols,
      //witty_comment: "",
      //explanation: "",
    }), this.persistTodayGameState);

    this.secondsSinceSubmitted = 0;

    // Get a list of all valid prior submissions
    const priorSubmissions = this.state.submissionInfos.filter(submissionInfo => submissionInfo.inclusion || submissionInfo.loading).map(submissionInfo => submissionInfo.submission);

    this.postSubmission(submission, priorSubmissions)
    .then(data => {
      const isValid = data.valid && !data.tooSimilar;

      var scoreDelta = 0;
      if (isValid) {
        scoreDelta = 1;
      }

      const submissionInfo = {
        "submission": data.intendedAnswer && isValid ? data.intendedAnswer : submission,
        inclusion: isValid,
        isValid: data.valid,
        tooSimilar: data.tooSimilar,
        loading: false,
        witty_comment: data.wittyComment,
        explanation: data.explanation,
      }

      this.setState(prevState => {
        // Collect submissions not matching the current submission
        const submissionInfos = prevState.submissionInfos.filter(submissionInfo => 
          // If loading, only include it if it doesn't match what we got back from the server
          submissionInfo.loading ? (submissionInfo.submission !== submission && submissionInfo.submission !== data.intendedAnswer) :
          // Otherwise, include it
          true);

        return {
          score: prevState.score + scoreDelta,
          submissionInfos: [submissionInfo, ...submissionInfos],
          witty_comment: data.wittyComment,
          ai_recently_responded: true,
          explanation: data.explanation,
          numLoading: prevState.numLoading - 1,
        };
      }, this.persistTodayGameState);

      // After 1 second, change the ai_recently_responded flag to false
      setTimeout(() => {
        this.setState({ ai_recently_responded: false });
      }, 400);

    });
  }

  handleSubmit = () => {
    var inputValue = this.inputRef.current.value;

    if (!inputValue) {
      return;
    }
    inputValue = inputValue.toLowerCase().trim();

    if (!this.state.submissions.includes(inputValue)) {
      this.insertSubmission(inputValue);
    }

    this.inputRef.current.value = "";
  };

  openCategorySelectModal = () => {
    this.setState({ modalEnabled: true });
  }

  setCategoryAndStart = category => {
    this.setState({ category, modalEnabled: false }, () => {
      this.startWithRandomCategory();
    });
  }

  closeModal = () => {
    this.setState({ modalEnabled: false });
  }

  frontPage = () => {
    this.persistTodayGameState();
    // Clear the timer
    clearInterval(this.timer);

    this.setState({ 
      screen: "instructions", 
      category: "", 
      submissions: [], 
      submissionInfos: [], 
      score: 0, 
      secondsRemaining: MAX_SECONDS, 
      percentageTime: 100, 
      witty_comment: "Good luck.", 
      ai_recently_responded: false, 
      modalEnabled: false, 
      submissionTextSize: "text-4xl", 
      submissionGridCols: "grid-cols-1" 
    });
  }

  share = () => {
    if (this.state.category === dailyCategories[this.day]) {
      var text = "I just scored " + this.state.score + " points on today's Categorcle! Can you beat me?";
      text += "\n Day " + this.day + ": ";
    } else {
      text = "I just scored " + this.state.score + " points on Categorcle! Can you beat me?\n";
    }
    this.state.submissionInfos.forEach(submissionInfo => {
      if (submissionInfo.tooSimilar) {
        text += "⚠️"
      }
      else if (submissionInfo.inclusion) {
        text += "✅"
      }
      else {
        text += "❌"
      }
    });
    text += "\nhttps://categorcle.app";

    // Open the share dialog using navigator.share
    if (navigator.share) {
      navigator.share({
        text: text,
      })
      .then(() => {
        console.log("Thanks for sharing!");
      })
      .catch(console.error);
    } else {
      navigator.clipboard.writeText(text).then(function() {
        alert("Copied to clipboard! \n\n" + text);
      }, function(err) {
        console.error('Async: Could not copy text: ', err);
      });
      
    }
  }

  requestHint = (shouldPauseTimer = true) => {
    this.setState(prevState => ({ 
      witty_comment: shouldPauseTimer ? "I'm thinking of a hint..." : prevState.witty_comment,
      explanation: shouldPauseTimer ? "" : prevState.explanation,
      loadingHint: shouldPauseTimer ? true : prevState.loadingHint,
      numLoading: shouldPauseTimer ? prevState.numLoading + 1 : prevState.numLoading,
    }));

    const prior_submissions = this.state.submissionInfos
      .filter(submissionInfo => submissionInfo.inclusion)
      .map(submissionInfo => submissionInfo.submission);

    fetch(`${BACKEND_URL}/request_hint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            {
              category: this.state.category,
              prior_submissions: prior_submissions,
            }),
    })
    .then(response => response.json())
    .then(data => {
      this.secondsSinceSubmitted = 0;
      console.log(data);

      this.setState(prevState => ({
        witty_comment: data.hint,
        loadingHint: shouldPauseTimer ? false : prevState.loadingHint,
        numLoading: shouldPauseTimer ? prevState.numLoading - 1 : prevState.numLoading,
        explanation: "",
      }));
    })
    .catch(error => {
      console.error(error);
      this.setState(prevState => ({numLoading: shouldPauseTimer ? prevState.numLoading - 1 : prevState.numLoading,}));
    });
  }

  showComments = submissionInfo => {
    this.setState({
      explanation: submissionInfo.explanation,
      witty_comment: submissionInfo.witty_comment,
    });
  }

  submissionEmoji = submissionInfo => {
    return submissionInfo.loading ? "⌛" : (submissionInfo.tooSimilar ? "⚠️" : (submissionInfo.inclusion ? "✅" : "❌"));
  }

  render() {
    return (
<>
      <div className="flex justify-center items-center h-screen fixed bottom">
      <div className="h-screen w-full sm:w-1/2 bg-cyan-600 relative">

      { this.state.screen === "instructions" && ( <>
        <div className="bg-amber-400 p-4 rounded-3xl mb-4 mx-1">
          <div className="rounded text-center font-extrabold text-5xl text-cyan-600">CATEGORCLE</div>
        </div>
        <div className="flex justify-center items-center">
          <img className="w-1/2" src="/img/rainbow-background3.png" alt="Categorcle AI robot"/>
        </div>
        <div className="px-4 my-9 text-center text-base sm:text-xl font-extrabold font-serif text-amber-400">
          <p> 
            Test your creativity! Given a category, you
            have {MAX_SECONDS}s to come up with as many items in that category as you can.
          </p>
          <p className="mt-4">
            A daily game ala Wordle.
            An improvisational robot will judge your submissions, and might give you hints!
          </p>
        </div>
        
        <div className="absolute bottom-0 w-full">
          <div className="flex justify-center items-center w-full">
            <button
              onClick={this.startWithRandomCategory} 
              className="bg-amber-400 p-3 rounded-3xl w-full m-1">
              <div className="text-center rounded font-extrabold text-cyan-600 text-5xl">
              START
              </div>
            </button> 
          </div>
          <div className="text-center w-full">
            <a href="#" onClick={this.openCategorySelectModal} className="text-zinc-400 underline font-extrabold text-xl">
              or, enter your own category</a>
          </div>


          
          <div className="invisible flex justify-center items-center w-full">
            <button
              onClick={this.startWithDailyCategory} 
              className="bg-amber-400 p-3 rounded-3xl w-full m-1">
              <div className="text-center rounded font-extrabold text-cyan-600 text-5xl">
              START
              </div>
            </button> 
          </div>
        </div>
        
        </>)}

      { (this.state.screen === "game" || this.state.screen === "score") && ( <>
        <div className="pt-1">
        </div>
        <div className="grid grid-cols-10 mt-1">
          <div className={`w-full col-span-8 ${this.state.numLoading <= 0 ? "bg-green-400" : "bg-zinc-400"} w-full p-1 rounded-l-3xl mx-1`}
                style={{ width: `${this.state.percentageTime}%`}}>
              <p className="invisible">text</p>
          </div>
          <div className="col-span-2 bg-teal-500 p-1 rounded-r-3xl mx-1 text-amber-500 font-extrabold text-center">
                  {this.state.secondsRemaining}
          </div>
        </div>

            
          <div className="grid grid-cols-10">
            <div className="col-span-2 p-2">
            <img className="" src="/img/rainbow-background3.png"  alt="Categorcle AI robot"/>
            </div> 
            <div className={`col-span-8 bg-teal-500 p-4 rounded-3xl my-2 mx-1 ${this.state.ai_recently_responded ? "text-amber-200" : "text-amber-400"} font-extrabold`}>
              <p className="text-red-500 opacity-50">{this.state.explanation}</p>
              {this.state.witty_comment}
            </div>

            {this.state.screen === "game" && ( <>
            <div className="w-full col-span-8 mb-1">
              <input
              ref={this.inputRef}
              style={{ width: `${100}%`}}
              className="focus:outline-none focus:ring-0 border-transparent bg-amber-400 p-4 rounded-l-3xl mx-1 w-full text-center text-amber-600 font-extrabold"
              type="text"
              placeholder="Enter category item here"
              onKeyDown={this.handleKeyDown}
              />
            </div>
            <button className="col-span-2 mb-1" onClick={this.handleSubmit}>
              <div className="bg-amber-600 p-4 rounded-r-3xl mx-1 mb-1 text-amber-900 text-center">
                    Enter
              </div>
            </button>
            </>)}

            {this.state.screen === "score" && ( <>
            <div className="col-span-10  bg-amber-400 p-4 rounded-3xl mb-1 mx-1 text-center text-amber-600 font-extrabold">
              <p className="font-secondary pb-4 text-[35px]">SCORE: {this.state.score}</p>
              {this.state.percentile !== -1 && ( <>
              <p className="font-secondary pb-4 inline">That's better than
              <span className="font-primary pb-4 font-bold inline"> {this.state.percentile}% </span> 
              of players today!</p> </>) }
            </div>
            </>)}
          </div>

            <div className="h-1/3 w-full">
          <div className="bg-green-500 text-amber-400 rounded-t-3xl text-center mx-1 text-3xl font-extrabold p-1">
          {this.state.category.toUpperCase()}
          {this.state.category === dailyCategories[this.day] && (
            <p className="text-zinc-400 font-bold text-base"> Day {this.day} </p>
          )}
          </div>

          <div className="relative bg-green-400 rounded-b-3xl text-center mx-1 text-3xl font-extrabold"
              style={{ height: `${100}%`}}>
            <div className={`grid m-auto ${this.state.submissionGridCols}`}>
              {this.state.submissionInfos.map((submissionInfo, index) => (
                <div key={index} 
                  className={`font-header  
                  ${this.state.submissionTextSize}
                  ${submissionInfo.loading ? "text-green-300" : (submissionInfo.inclusion ? "text-green-700" : "text-gray-500")}`}>
                  <a href="#" onClick={() => {this.showComments(submissionInfo)}}>{submissionInfo.submission} {this.submissionEmoji(submissionInfo)} </a>
                </div>
              ))}
              </div>
            
            {this.state.screen==="game" && ( <>
            <div className="absolute right-0 bottom-0">
              
              <button onClick={this.requestHint} className="bg-green-400 p-1 rounded-full mb-2 mr-2"> 
              {this.state.loadingHint ? (
                <svg width="24px" height="24px" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="#fbbf24"><path d="M17 12.5a.5.5 0 100-1 .5.5 0 000 1zM12 12.5a.5.5 0 100-1 .5.5 0 000 1zM7 12.5a.5.5 0 100-1 .5.5 0 000 1z" fill="#000000" stroke="#fbbf24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 1.821.487 3.53 1.338 5L2.5 21.5l4.5-.838A9.955 9.955 0 0012 22z" stroke="#fbbf24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>
               ) : (
                <svg width="24px" height="24px" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="#fbbf24"><path d="M9 9c0-3.5 5.5-3.5 5.5 0 0 2.5-2.5 2-2.5 5M12 18.01l.01-.011" stroke="#fbbf24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 1.821.487 3.53 1.338 5L2.5 21.5l4.5-.838A9.955 9.955 0 0012 22z" stroke="#fbbf24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>
              )}
              </button>
            </div>
            </> )}

          </div>

          <div className="text-center w-full grid grid-cols-2 mt-3 px-4">
            <div className="col-span-1 text-left">
              <a href="#" onClick={this.frontPage} className="text-zinc-400 underline font-extrabold text-xl">
                back</a>
            </div>
            <div className="col-span-1 text-right">
              {this.state.screen !== "score" && (
              <a href="#" onClick={() => { this.setState({secondsRemaining: 0}, this.end)}} className="text-zinc-400 underline font-extrabold text-xl">
                done</a> )}
                {this.state.screen === "score" && (
              <span className=" bg-amber-400 rounded-xl p-3">
                <a href="#" onClick={this.share} className="font-extrabold text-xl text-cyan-600">
                  share</a> 
              </span>)}
            </div>
          </div>
        </div>

        



        </>)}

      </div> 
      </div>
      
      
      <Modal enabled={this.state.modalEnabled}
            category={this.state.category}
            onClose={this.setCategoryAndStart}
            startWithCategory={this.startWithCategory}
            onCancel={this.closeModal}
          />
</>
    );
  }
}