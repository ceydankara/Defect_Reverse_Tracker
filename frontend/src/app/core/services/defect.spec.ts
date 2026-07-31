import { TestBed } from '@angular/core/testing';

import { Defect } from './defect';

describe('Defect', () => {
  let service: Defect;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Defect);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
