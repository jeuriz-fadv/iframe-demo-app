import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  ngOnInit(): void {
    window.addEventListener('message', (event) => {
      const e = event as MessageEvent;
      console.log('inside event listener', e);
    });
  }
}
