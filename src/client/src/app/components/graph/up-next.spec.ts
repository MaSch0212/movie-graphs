import { ApiGraphNodeStatus } from '../../api/models';
import { findUpNext } from './up-next';

const node = (id: string, status: ApiGraphNodeStatus) => ({ id, status });
const edge = (sourceNodeId: string, targetNodeId: string) => ({ sourceNodeId, targetNodeId });
const ids = (nodes: { id: string }[]) => nodes.map(node => node.id);

describe('findUpNext', () => {
  it('lists the titles being watched and the ones whose dependencies are done', () => {
    const { watching, ready } = findUpNext(
      [
        node('a', 'watched'),
        node('b', 'ignored'),
        node('c', 'unwatched'),
        node('d', 'watching'),
        node('e', 'unwatched'),
        node('f', 'unwatched'),
      ],
      [edge('a', 'c'), edge('b', 'c'), edge('a', 'd'), edge('d', 'e')]
    );
    expect(ids(watching)).toEqual(['d']);
    // e waits for d; f has no dependencies.
    expect(ids(ready)).toEqual(['c', 'f']);
  });

  it('also checks the dependencies before a skipped title', () => {
    const { ready } = findUpNext(
      [node('a', 'unwatched'), node('b', 'ignored'), node('c', 'unwatched')],
      [edge('a', 'b'), edge('b', 'c')]
    );
    expect(ids(ready)).toEqual(['a']);
  });

  it('does not get stuck on cycles', () => {
    const { ready } = findUpNext(
      [node('a', 'watched'), node('b', 'watched'), node('c', 'unwatched')],
      [edge('a', 'b'), edge('b', 'a'), edge('b', 'c')]
    );
    expect(ids(ready)).toEqual([]);
  });
});
