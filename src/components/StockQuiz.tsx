import { useEffect, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Quiz, QuizQuestion } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface StockQuizProps {
  quiz: Quiz;
  onComplete: (score: number) => void;
}

const StockQuiz = ({ quiz, onComplete }: StockQuizProps) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0); // used only for display ordering
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answeredCorrectly, setAnsweredCorrectly] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Adaptive quiz state
  const [askedIds, setAskedIds] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [currentDifficulty, setCurrentDifficulty] = useState<"Easy" | "Medium" | "Difficult">("Easy");

  // --- ADAPTIVE SETTINGS ---
  // We will ask 5 questions total, even if pool has 9.
  const QUESTIONS_TO_ASK = 5;
  const totalQuestions = QUESTIONS_TO_ASK;

  // Build pools grouped by difficulty for selection
  const pools = useMemo(() => {
    let pools: Record<string, QuizQuestion[]> = { Easy: [], Medium: [], Hard: [] };

    // CRITICAL FIX: Clone questions AND enforce unique IDs to prevent collision bugs
    const allQuestions = quiz.questions.map((q, idx) => ({
      ...q,
      id: `question-${idx}-${Date.now()}` // Completely unique ID
    }));

    // 1. First pass: Normalize and group
    allQuestions.forEach((q) => {
      let raw = (q as any).difficulty || "Medium";
      let d = raw.trim();
      // Normalize
      if (d.toLowerCase() === "easy") d = "Easy";
      else if (d.toLowerCase() === "medium") d = "Medium";
      else if (d.toLowerCase() === "hard" || d.toLowerCase() === "difficult") d = "Hard";
      else d = "Medium";

      (q as any).difficulty = d; // now safe to mutate local clone
      if (!pools[d]) pools[d] = [];
      pools[d].push(q);
    });

    // 2. Balancing Act: Dynamic distribution
    const totalCount = allQuestions.length;
    // Target roughly 33% split, but ensure at least 1 of each if possible
    const targetCount = Math.max(1, Math.floor(totalCount / 3));

    // Function to move questions from Source -> Dest
    const moveQuestions = (source: string, dest: string, count: number) => {
      if (!pools[source] || !pools[dest]) return;
      const available = Math.max(0, pools[source].length - 1); // Always leave 1
      const toTake = Math.min(count, available);

      const moved = pools[source].splice(0, toTake);
      moved.forEach(q => {
        (q as any).difficulty = dest;
        pools[dest].push(q);
      });
    };

    // 1. Ensure Easy has enough
    if (pools["Easy"].length < targetCount) {
      const needed = targetCount - pools["Easy"].length;
      // Prefer taking from Medium first
      moveQuestions("Medium", "Easy", needed);

      // Still need? Take from Hard
      if (pools["Easy"].length < targetCount) {
        const stillNeeded = targetCount - pools["Easy"].length;
        moveQuestions("Hard", "Easy", stillNeeded);
      }
    }

    // 2. Ensure Medium has enough (if we stripped it too much?)
    // Actually, usually we start with too many Mediums.

    // 3. Ensure Hard has enough
    if (pools["Hard"].length < targetCount) {
      const needed = targetCount - pools["Hard"].length;
      moveQuestions("Medium", "Hard", needed);
    }

    // Checking if we have at least 1 Easy to start
    if (pools["Easy"].length === 0 && allQuestions.length > 0) {
      const q = allQuestions[0];
      const oldD = (q as any).difficulty;
      if (pools[oldD]) pools[oldD] = pools[oldD].filter(i => i.id !== q.id);
      (q as any).difficulty = "Easy";
      pools["Easy"].push(q);
    }

    // Debug output
    console.log("DEBUG: Final Pools", {
      Easy: pools.Easy.length,
      Medium: pools.Medium.length,
      Hard: pools.Hard.length
    });

    return pools as Record<"Easy" | "Medium" | "Hard", QuizQuestion[]>;
  }, [quiz.questions]);

  // Helper to pick next question (Moved up to be available for useEffect)
  const pickNextQuestion = useCallback((difficulty: "Easy" | "Medium" | "Hard", alreadyAsked: string[]) => {
    // 1. Specific difficulty map search
    const orderMap: Record<string, ("Easy" | "Medium" | "Hard")[]> = {
      Easy: ["Easy", "Medium", "Hard"],
      Medium: ["Medium", "Easy", "Hard"],
      Hard: ["Hard", "Medium", "Easy"],
    };

    // Normalize input just in case
    let d = difficulty;
    if (d === "Difficult" as any) d = "Hard";

    const order = orderMap[d] || ["Medium", "Easy", "Hard"];

    for (const lvl of order) {
      const pool = pools[lvl] || [];
      const candidates = pool.filter((q) => !alreadyAsked.includes(q.id) && q.id !== currentQuestion?.id);
      if (candidates.length > 0) {
        const idx = Math.floor(Math.random() * candidates.length);
        return candidates[idx];
      }
    }

    // 2. Fallback: Search ALL pools for ANY unasked question
    // This handles edge cases where preferred order failed (shouldn't happen often)
    const allPools = [...(pools.Easy || []), ...(pools.Medium || []), ...(pools.Hard || [])];
    const anyCandidate = allPools.find(q => !alreadyAsked.includes(q.id) && q.id !== currentQuestion?.id);

    return anyCandidate || null;
  }, [pools, currentQuestion?.id]);

  // Initialize first question when component mounts or when pools are ready
  useEffect(() => {
    if (currentQuestion) return;
    // Start with "Medium" or "Easy" ? Let's start with Easy as per usual flow or Medium?
    // User requested: "easy -> medium -> hard". So start with Easy.
    const first = pickNextQuestion("Easy", askedIds) || quiz.questions[0] || null;

    if (first) {
      setCurrentQuestion(first);
      const actualDifficulty = (first as any).difficulty === "Difficult" ? "Hard" : ((first as any).difficulty || "Medium");
      setCurrentDifficulty(actualDifficulty);
    }
  }, [pools, askedIds, pickNextQuestion, quiz.questions]);

  const { user } = useAuth();

  const progress = ((askedIds.length + (quizCompleted ? 0 : (currentQuestion ? 1 : 0))) / totalQuestions) * 100;

  const isDailyBasics = quiz.id === "basics";
  const today = new Date().toDateString();

  const handleSelectOption = (index: number) => {
    if (answeredCorrectly !== null) return;
    setSelectedOption(index);
  };

  const handleCheckAnswer = () => {
    if (selectedOption === null) return;
    if (!currentQuestion) return;

    const isCorrect = selectedOption === currentQuestion.correctOption;
    setAnsweredCorrectly(isCorrect);
  };

  const handleNextQuestion = () => {
    const gained = answeredCorrectly ? 1 : 0;
    const newScore = score + gained;
    setScore(newScore);

    const newAskedIds = currentQuestion ? [...askedIds, currentQuestion.id] : [...askedIds];
    setAskedIds(newAskedIds);

    // --- ADAPTIVE LOGIC ---
    // Safely derive current difficulty from the question object itself to avoid state desync
    let currentDiffRaw = (currentQuestion as any).difficulty || currentDifficulty;
    if (currentDiffRaw === "Difficult") currentDiffRaw = "Hard";

    let targetDifficulty: "Easy" | "Medium" | "Hard" = currentDiffRaw as any;

    if (answeredCorrectly) {
      // promote
      if (targetDifficulty === "Easy") targetDifficulty = "Medium";
      else if (targetDifficulty === "Medium") targetDifficulty = "Hard";
      // if Hard, stay Hard
    } else {
      // demote
      if (targetDifficulty === "Hard") targetDifficulty = "Medium";
      else if (targetDifficulty === "Medium") targetDifficulty = "Easy";
      // if Easy, stay Easy
    }

    setSelectedOption(null);
    setAnsweredCorrectly(null);

    // Check completion
    if (newAskedIds.length >= totalQuestions) {
      setFinalScore(newScore);
      setQuizCompleted(true);
      processQuizCompletion(newScore);
      return;
    }

    // Pick next
    let nextQuestion = pickNextQuestion(targetDifficulty, newAskedIds);

    if (!nextQuestion) {
      // fallback: find any unasked
      nextQuestion = quiz.questions.find((q) => !newAskedIds.includes(q.id) && q.id !== currentQuestion?.id) || null;
    }

    if (nextQuestion) {
      setCurrentQuestion(nextQuestion);
      let d = (nextQuestion as any).difficulty || "Medium";
      if (d === "Difficult") d = "Hard";
      setCurrentDifficulty(d);
      setCurrentQuestionIndex((i) => i + 1);
    } else {
      setFinalScore(newScore);
      setQuizCompleted(true);
      processQuizCompletion(newScore);
    }
  };



  const processQuizCompletion = async (totalScore: number) => {
    const calculatedScore = calculateFinalScore(totalScore);
    setIsProcessing(true);

    try {
      // Mark daily quiz as completed
      if (isDailyBasics && user) {
        localStorage.setItem(`quiz_completed_basics_${today}_${user.id}`, "true");
      }

      // Update the user's points in the database using the RPC function
      if (user) {
        const { data, error } = await supabase.rpc('increment_points', {
          amount: calculatedScore.points
        });

        if (error) {
          console.error("Error updating points:", error);
          toast.error("Failed to add points to your account");
        } else {
          toast.success(`${calculatedScore.points} points added to your account!`);
        }
      }
    } catch (err) {
      console.error("Error processing quiz completion:", err);
      toast.error("Failed to process quiz results");
    } finally {
      setIsProcessing(false);
      onComplete(totalScore);
    }
  };

  const calculateFinalScore = (totalScore: number) => {
    // --- FIX 2: Calculate percentage based on totalQuestions (e.g., 5) ---
    const percentage = (totalScore / totalQuestions) * 100;
    return {
      correct: totalScore,
      total: totalQuestions, // Use totalQuestions here
      percentage: percentage.toFixed(0),
      points: Math.round((percentage / 100) * quiz.points)
    };
  };

  return (
    <div className="w-full max-h-[70vh] overflow-y-auto">
      <Card className="w-full">
        {!quizCompleted ? (
          <>
            <CardHeader>
              <CardTitle>{quiz.title}</CardTitle>
              {currentQuestion && (
                <div className="text-sm text-gray-600">Difficulty: {((currentQuestion as any).difficulty) || currentDifficulty}</div>
              )}
              {isDailyBasics && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-2">
                  <p className="text-sm text-blue-700">
                    {/* --- FIX 2: Update text to use totalQuestions --- */}
                    🌟 Daily Challenge: {totalQuestions} questions selected just for you today!
                  </p>
                </div>
              )}
              <div className="flex justify-between items-center">
                {/* --- FIX 2: Update text to use totalQuestions --- */}
                <span className="text-sm">Question {currentQuestionIndex + 1} of {totalQuestions}</span>
                <span className="text-sm">Score: {score + (answeredCorrectly ? 1 : 0)}</span>
              </div>
              <Progress value={progress} className="mt-2" />
            </CardHeader>

            <CardContent>
              <div className="space-y-4">
                <h3 className="font-medium text-lg">{currentQuestion?.text}</h3>

                <RadioGroup value={selectedOption?.toString()} className="space-y-2">
                  {currentQuestion?.options.map((option, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center space-x-2 border p-3 rounded-md cursor-pointer",
                        selectedOption === index && answeredCorrectly === null && "border-learngreen-400 bg-learngreen-50",
                        answeredCorrectly !== null && index === currentQuestion.correctOption && "border-green-400 bg-green-50",
                        answeredCorrectly === false && selectedOption === index && "border-red-400 bg-red-50"
                      )}
                      onClick={() => handleSelectOption(index)}
                    >
                      <RadioGroupItem
                        value={index.toString()}
                        checked={selectedOption === index}
                        id={`option-${index}`}
                      />
                      <Label htmlFor={`option-${index}`} className="font-normal flex-1 cursor-pointer">
                        {option}
                      </Label>
                      {answeredCorrectly !== null && index === currentQuestion.correctOption && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      {answeredCorrectly === false && selectedOption === index && (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  ))}
                </RadioGroup>

                {answeredCorrectly !== null && (
                  <div className={cn(
                    "p-3 rounded-md",
                    answeredCorrectly ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  )}>
                    <p className="font-medium mb-1">
                      {answeredCorrectly ? "Correct!" : "Incorrect!"}
                    </p>
                    <p className="text-sm">{currentQuestion?.explanation}</p>
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex justify-end space-x-4">
              {answeredCorrectly === null ? (
                <Button
                  onClick={handleCheckAnswer}
                  className="bg-learngreen-600 hover:bg-learngreen-700"
                  disabled={selectedOption === null}
                >
                  Check Answer
                </Button>
              ) : (
                <Button
                  onClick={handleNextQuestion}
                  className="bg-learngreen-600 hover:bg-learngreen-700"
                >
                  {/* --- FIX 2: Update text to use totalQuestions --- */}
                  {currentQuestionIndex < totalQuestions - 1 ? "Next Question" : "Finish Quiz"}
                </Button>
              )}
            </CardFooter>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Quiz Completed!</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="text-center space-y-4">
                <div className="mb-4">
                  <div className="text-6xl font-bold text-learngreen-600 mb-2">
                    {calculateFinalScore(finalScore).percentage}%
                  </div>
                  <p className="text-xl">
                    {/* --- FIX 2: Update text to use totalQuestions --- */}
                    You got {finalScore} out of {totalQuestions} questions right
                  </p>
                </div>

                <div className="p-4 bg-learngreen-50 rounded-md">
                  <p className="font-medium text-learngreen-700">
                    You earned {calculateFinalScore(finalScore).points} points!
                  </p>
                  {isDailyBasics && (
                    <p className="text-sm text-learngreen-600 mt-1">
                      {/* --- FIX 2: Update text to use totalQuestions --- */}
                      Come back tomorrow for {totalQuestions} new questions! 📅
                    </p>
                  )}
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex justify-center">
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="mr-2"
                disabled={isProcessing}
              >
                Try Again
              </Button>
              <Button
                className="bg-learngreen-600 hover:bg-learngreen-700"
                onClick={() => window.location.href = '/games'}
                disabled={isProcessing}
              >
                Back to Games
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
};

export default StockQuiz;