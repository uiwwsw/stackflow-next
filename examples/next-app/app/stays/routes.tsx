import { StackLoading } from '@uiwwsw/stackflow-next';
import { stays } from './data';
import { BookLoading, BookScreen, StayScreen } from './screens';

export type IdProps = { params: Promise<{ id: string }> };
export function generateStaticParams() { return stays.map(stay => ({ id: stay.id })); }
export function StayPage({params}: IdProps) { return <StayScreen params={params} />; }
export function BookPage({params}: IdProps) { return <BookScreen params={params} />; }
export function BookPageLoading() { return <StackLoading><BookLoading /></StackLoading>; }
