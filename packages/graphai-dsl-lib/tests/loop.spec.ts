import { task } from 'fp-ts';
import { loopTask, recur } from '../src/lib/loop';

describe('loop', () => {
  it('should loopTask', async () => {
    const sum = await loopTask(0, a => (a < 10 ? task.of(recur(a + 1)) : task.of(a)))();
    expect(sum).toBe(10);
  });
});
