let count = 0;

function increment() {
  count++;
  document.getElementById('counter').textContent = count;
}

function decrement() {
  count--;
  document.getElementById('counter').textContent = count;
}
