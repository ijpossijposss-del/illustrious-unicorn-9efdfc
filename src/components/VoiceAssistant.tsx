import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';

type SpeechRecognitionResultLike = ArrayLike<{ transcript: string }> & { isFinal?: boolean };
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onspeechend: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const routes: Array<[string[], string, string]> = [
  [['ai analytics', 'ai insights', 'ai analytics page'], '/ai-analytics', 'AI analytics'],
  [['branch sales report', 'branch report', 'sales by branch'], '/branch-sales-report', 'branch sales report'],
  [['branch transaction history', 'branch transactions', 'transactions by branch'], '/branch-transactions', 'branch transaction history'],
  [['staff bulk import', 'staff import', 'employee import'], '/staff-bulk-import', 'staff bulk import'],
  [['receipt settings', 'receipt configuration', 'receipt settings page'], '/receipt-settings', 'receipt settings'],
  [['admin control', 'admin control panel', 'admin page', 'control panel'], '/admin-control', 'admin control'],
  [['end of day', 'end of day reconciliation', 'eod', 'day reconciliation'], '/eod', 'end of day'],
  [['asset checkout', 'asset checkout log', 'asset log'], '/asset-checkout', 'asset checkout'],
  [['fraud detection', 'fraud detection page', 'fraud'], '/fraud-detection', 'fraud detection'],
  [['clear records', 'clear records page', 'clear data'], '/clear-records', 'clear records'],
  [['customer display', 'customer screen', 'customer display screen'], '/customer', 'customer display'],
  [['online order', 'customer order'], '/order', 'customer order'],
  [['point of sale', 'point of sale page', 'checkout', 'cashier', 'pos'], '/pos', 'point of sale'],
  [['inventory management', 'inventory management page', 'inventory', 'stock'], '/inventory-mgmt', 'inventory'],
  [['transaction history', 'sales history', 'transactions page', 'transactions'], '/transactions', 'transactions'],
  [['category manager', 'category page', 'categories'], '/categories', 'categories'],
  [['branch manager', 'branch page', 'locations', 'branches'], '/branches', 'branches'],
  [['staff management', 'staff page', 'employees', 'team', 'staff'], '/staff', 'staff'],
  [['customer list', 'customers page', 'customers'], '/customers', 'customers'],
  [['report generator', 'reports page', 'reports'], '/reports', 'reports'],
  [['business analytics', 'analytics page', 'analytics'], '/analytics', 'analytics'],
  [['operations center', 'operations page', 'operations'], '/operations', 'operations'],
  [['returns', 'refunds'], '/returns', 'returns'],
  [['leaderboard', 'staff leaderboard', 'leader board'], '/leaderboard', 'leaderboard'],
  [['bulk import', 'bulk import page', 'product import'], '/bulk-import', 'bulk import'],
  [['printer settings', 'printer page', 'settings'], '/settings', 'settings'],
  [['permissions', 'my permissions', 'staff permissions', 'permissions page'], '/my-permissions', 'permissions'],
  [['expenses', 'expenses page', 'costs'], '/expenses', 'expenses'],
  [['products', 'products page', 'product list', 'catalog'], '/products', 'products'],
  [['dashboard', 'dashboard page', 'home', 'main screen'], '/dashboard', 'dashboard'],
];

const commandPrefixes = /^(please\s+)?(open|show|go\s+to|navigate\s+to|take\s+me\s+to|load|view)\s+(the\s+)?/i;

function normalizeCommand(rawCommand: string) {
  return rawCommand.toLowerCase().replace(/[.,!?]/g, '').replace(commandPrefixes, '').replace(/\s+(page|section|menu)$/, '').trim();
}

function hasKnownCommand(command: string) {
  return routes.some(([phrases]) => phrases.some((phrase) => command.includes(phrase)))
    || (command.includes('how many') && (command.includes('sale') || command.includes('product') || command.includes('branch')))
    || command.includes('revenue')
    || command.includes('sales total')
    || command.includes('who am i')
    || command.includes('my name');
}

function getRecognitionConstructor() {
  const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
}

export default function VoiceAssistant() {
  const navigate = useNavigate();
  const sales = useStore((state) => state.sales);
  const products = useStore((state) => state.products);
  const branches = useStore((state) => state.branches);
  const currentUser = useStore((state) => state.currentUser);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const commandTimerRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const latestTranscriptRef = useRef('');
  const userWantsListeningRef = useRef(false);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('Ready for a command');
  const [supported, setSupported] = useState(true);
  const [textCommand, setTextCommand] = useState('');


  const runCommand = (rawCommand: string) => {
    const command = normalizeCommand(rawCommand);
    if (command.includes('how many') && command.includes('sale')) {
      const response = `There are ${sales.length} recorded sales.`;
      setMessage(response);
      return;
    }
    if (command.includes('revenue') || command.includes('sales total')) {
      const revenue = sales.reduce((sum, sale) => sum + (Number.isFinite(sale.total) ? sale.total : 0), 0);
      const response = `Recorded revenue is ${revenue.toLocaleString()} leones.`;
      setMessage(response);
      return;
    }
    const route = routes.find(([phrases]) => phrases.some((phrase) => command.includes(phrase)));
    if (route) {
      navigate(route[1]);
      const response = `Opening ${route[2]}.`;
      setMessage(response);
      return;
    }
    if (command.includes('how many') && command.includes('product')) {
      const response = `There are ${products.filter((product) => product.active).length} active products.`;
      setMessage(response);
      return;
    }
    if (command.includes('how many') && command.includes('branch')) {
      const response = `There are ${branches.filter((branch) => branch.active).length} active branches.`;
      setMessage(response);
      return;
    }
    if (command.includes('who am i') || command.includes('my name')) {
      const response = currentUser ? `You are ${currentUser.name}.` : 'No user is signed in.';
      setMessage(response);
      return;
    }
    const response = 'I did not understand that. Try asking me to open a page, show revenue, count sales, count products, or count branches.';
    setMessage(response);
  };

  const submitTextCommand = (event: React.FormEvent) => {
    event.preventDefault();
    const command = textCommand.trim();
    if (!command) return;
    setTextCommand('');
    runCommand(command);
  };

  const startListening = () => {
    const Constructor = getRecognitionConstructor();
    if (!Constructor) {
      setSupported(false);
      setMessage('Voice input is not supported in this browser.');
      return;
    }
    userWantsListeningRef.current = true;
    recognitionRef.current?.abort();
    const recognition = new Constructor();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript || '').join(' ').trim();
      if (!transcript) return;
      latestTranscriptRef.current = transcript;
      const isFinal = Boolean(event.results[event.results.length - 1]?.isFinal);
      const actionable = hasKnownCommand(normalizeCommand(transcript));
      if (!isFinal && !actionable) return;
      if (commandTimerRef.current) window.clearTimeout(commandTimerRef.current);
      commandTimerRef.current = window.setTimeout(() => {
        commandTimerRef.current = null;
        const command = latestTranscriptRef.current;
        latestTranscriptRef.current = '';
        if (command) runCommand(command);
      }, isFinal ? 250 : 450);
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
        userWantsListeningRef.current = false;
        setListening(false);
        setMessage(event.error === 'not-allowed' ? 'Microphone permission was denied.' : `Microphone error: ${event.error}.`);
      }
    };
    recognition.onspeechend = () => {
      if (!latestTranscriptRef.current || commandTimerRef.current) return;
      const command = latestTranscriptRef.current;
      latestTranscriptRef.current = '';
      const normalized = normalizeCommand(command);
      if (command && (hasKnownCommand(normalized) || normalized.length > 0 && !/^open$|^show$|^go to$/.test(normalized))) runCommand(command);
    };
    recognition.onend = () => {
      if (!userWantsListeningRef.current) {
        setListening(false);
        return;
      }
      if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = window.setTimeout(() => {
        if (userWantsListeningRef.current) startListening();
      }, 150);
    };
    recognitionRef.current = recognition;
    setMessage('Listening...');
    setListening(true);
    try {
      recognition.start();
    } catch {
      userWantsListeningRef.current = false;
      setListening(false);
      setMessage('The microphone is already busy. Please try again.');
    }
  };

  const stopListening = () => {
    userWantsListeningRef.current = false;
    if (commandTimerRef.current) window.clearTimeout(commandTimerRef.current);
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
    latestTranscriptRef.current = '';
    recognitionRef.current?.stop();
    setListening(false);
    setMessage('Ready for a command');
  };

  useEffect(() => () => {
    userWantsListeningRef.current = false;
    if (commandTimerRef.current) window.clearTimeout(commandTimerRef.current);
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
    recognitionRef.current?.abort();
  }, []);

  return (
    <div className="voice-assistant" aria-label="Voice assistant">
      <form className="voice-assistant-text-form" onSubmit={submitTextCommand}>
        <input className="voice-assistant-text-input" value={textCommand} onChange={(event) => setTextCommand(event.target.value)} placeholder="Ask AI to open a page..." aria-label="AI command" />
        <button className="voice-assistant-send" type="submit" aria-label="Run AI command" title="Run AI command">↵</button>
      </form>
      <button className={`voice-assistant-button${listening ? ' listening' : ''}`} type="button" onClick={listening ? stopListening : startListening} aria-label={listening ? 'Stop voice assistant' : 'Start voice assistant'} title={supported ? 'Voice assistant' : 'Voice input unavailable'}>
        {listening ? '■' : '🎙'}
      </button>
      <span className="voice-assistant-status" role="status">{message}</span>
    </div>
  );
}